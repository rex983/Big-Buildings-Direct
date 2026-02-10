import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, isAdmin } from "@/lib/auth";

const ticketTypes = [
  "WELCOME_CALL",
  "LPP",
  "BUILDING_UPDATE",
  "INFO_UPDATE",
  "MANUFACTURER_CHANGE",
  "OTHER",
] as const;

const ticketStatuses = [
  "OPEN",
  "IN_PROGRESS",
  "PENDING",
  "RESOLVED",
  "CLOSED",
] as const;

const ticketPriorities = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

const createTicketSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  subject: z.string().min(1, "Subject is required").max(200),
  description: z.string().optional(),
  type: z.enum(ticketTypes).default("OTHER"),
  priority: z.enum(ticketPriorities).default("NORMAL"),
  assignedToId: z.string().optional(),
});

// Generate ticket number
async function generateTicketNumber(): Promise<string> {
  const lastTicket = await prisma.ticket.findFirst({
    orderBy: { createdAt: "desc" },
    select: { ticketNumber: true },
  });

  let nextNumber = 1;
  if (lastTicket?.ticketNumber) {
    const match = lastTicket.ticketNumber.match(/TKT-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `TKT-${nextNumber.toString().padStart(5, "0")}`;
}

// GET /api/tickets - List tickets
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission(["orders.view"]);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const priority = searchParams.get("priority");
    const search = searchParams.get("search");
    const assignedToMe = searchParams.get("assignedToMe") === "true";
    const orderId = searchParams.get("orderId");

    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (priority) {
      where.priority = priority;
    }

    if (assignedToMe) {
      where.assignedToId = user.id;
    }

    if (orderId) {
      where.orderId = orderId;
    }

    if (search) {
      where.OR = [
        { ticketNumber: { contains: search } },
        { subject: { contains: search } },
        { order: { orderNumber: { contains: search } } },
        { order: { customerName: { contains: search } } },
      ];
    }

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              customerName: true,
              customerEmail: true,
              customerPhone: true,
              buildingType: true,
              buildingSize: true,
              installer: true,
              wcStatus: true,
              lppStatus: true,
            },
          },
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          assignedTo: {
            select: { id: true, firstName: true, lastName: true },
          },
          _count: {
            select: { notes: true, activities: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.ticket.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: tickets,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("GET /api/tickets error:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to fetch tickets" },
      { status: 500 }
    );
  }
}

// POST /api/tickets - Create ticket
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission(["orders.view"]);

    // Only Admin, Manager, BST can create tickets
    const canCreate =
      isAdmin(user.roleName) ||
      user.roleName === "Manager" ||
      user.roleName === "BST";

    if (!canCreate) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to create tickets" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createTicketSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { orderId, subject, description, type, priority, assignedToId } =
      validation.data;

    // Verify order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    // Generate ticket number
    const ticketNumber = await generateTicketNumber();

    // Create ticket with activity log in transaction
    const ticket = await prisma.$transaction(async (tx) => {
      const newTicket = await tx.ticket.create({
        data: {
          ticketNumber,
          subject,
          description,
          type,
          priority,
          status: "OPEN",
          orderId,
          createdById: user.id,
          assignedToId: assignedToId || null,
        },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              customerName: true,
            },
          },
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          assignedTo: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      // Create activity log
      await tx.ticketActivity.create({
        data: {
          ticketId: newTicket.id,
          userId: user.id,
          action: "CREATED",
          description: `Ticket created for order ${order.orderNumber}`,
          metadata: JSON.stringify({
            type,
            priority,
            assignedToId: assignedToId || null,
          }),
        },
      });

      // If assigned, create assignment activity
      if (assignedToId) {
        const assignee = await tx.user.findUnique({
          where: { id: assignedToId },
          select: { firstName: true, lastName: true },
        });

        await tx.ticketActivity.create({
          data: {
            ticketId: newTicket.id,
            userId: user.id,
            action: "ASSIGNED",
            description: `Ticket assigned to ${assignee?.firstName} ${assignee?.lastName}`,
            metadata: JSON.stringify({ assignedToId }),
          },
        });
      }

      return newTicket;
    });

    return NextResponse.json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    console.error("POST /api/tickets error:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to create ticket" },
      { status: 500 }
    );
  }
}
