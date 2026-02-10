import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, isAdmin } from "@/lib/auth";

const ticketStatuses = [
  "OPEN",
  "IN_PROGRESS",
  "PENDING",
  "RESOLVED",
  "CLOSED",
] as const;

const ticketPriorities = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

const updateTicketSchema = z.object({
  subject: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(ticketStatuses).optional(),
  priority: z.enum(ticketPriorities).optional(),
  assignedToId: z.string().nullable().optional(),
  resolution: z.string().optional(),
});

// GET /api/tickets/[ticketId] - Get single ticket
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const user = await requirePermission(["orders.view"]);
    const { ticketId } = await params;

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
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
            buildingColor: true,
            deliveryAddress: true,
            deliveryCity: true,
            deliveryState: true,
            deliveryZip: true,
            installer: true,
            foundationType: true,
            totalPrice: true,
            depositAmount: true,
            depositCollected: true,
            status: true,
            wcStatus: true,
            lppStatus: true,
            sentToManufacturer: true,
            sentToManufacturerDate: true,
            dateSold: true,
            salesRep: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        notes: {
          include: {
            author: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        activities: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { success: false, error: "Ticket not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    console.error("GET /api/tickets/[ticketId] error:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to fetch ticket" },
      { status: 500 }
    );
  }
}

// PATCH /api/tickets/[ticketId] - Update ticket
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const user = await requirePermission(["orders.view"]);
    const { ticketId } = await params;

    // Only Admin, Manager, BST can update tickets
    const canUpdate =
      isAdmin(user.roleName) ||
      user.roleName === "Manager" ||
      user.roleName === "BST";

    if (!canUpdate) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to update tickets" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = updateTicketSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    // Get current ticket
    const currentTicket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        assignedTo: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    if (!currentTicket) {
      return NextResponse.json(
        { success: false, error: "Ticket not found" },
        { status: 404 }
      );
    }

    const { subject, description, status, priority, assignedToId, resolution } =
      validation.data;

    // Build update data and activity logs
    const updateData: Record<string, unknown> = {};
    const activities: Array<{
      action: string;
      description: string;
      metadata: string;
    }> = [];

    if (subject !== undefined && subject !== currentTicket.subject) {
      updateData.subject = subject;
      activities.push({
        action: "UPDATED",
        description: `Subject updated`,
        metadata: JSON.stringify({
          field: "subject",
          oldValue: currentTicket.subject,
          newValue: subject,
        }),
      });
    }

    if (description !== undefined && description !== currentTicket.description) {
      updateData.description = description;
      activities.push({
        action: "UPDATED",
        description: `Description updated`,
        metadata: JSON.stringify({
          field: "description",
          oldValue: currentTicket.description,
          newValue: description,
        }),
      });
    }

    if (status !== undefined && status !== currentTicket.status) {
      updateData.status = status;

      // Handle resolved/closed timestamps
      if (status === "RESOLVED" && !currentTicket.resolvedAt) {
        updateData.resolvedAt = new Date();
      }
      if (status === "CLOSED" && !currentTicket.closedAt) {
        updateData.closedAt = new Date();
      }
      // If reopening, clear resolved/closed timestamps
      if (
        (currentTicket.status === "RESOLVED" || currentTicket.status === "CLOSED") &&
        (status === "OPEN" || status === "IN_PROGRESS" || status === "PENDING")
      ) {
        updateData.resolvedAt = null;
        updateData.closedAt = null;
        activities.push({
          action: "REOPENED",
          description: `Ticket reopened from ${currentTicket.status} to ${status}`,
          metadata: JSON.stringify({
            oldStatus: currentTicket.status,
            newStatus: status,
          }),
        });
      } else {
        const actionMap: Record<string, string> = {
          RESOLVED: "RESOLVED",
          CLOSED: "CLOSED",
        };
        activities.push({
          action: actionMap[status] || "STATUS_CHANGED",
          description: `Status changed from ${currentTicket.status} to ${status}`,
          metadata: JSON.stringify({
            oldStatus: currentTicket.status,
            newStatus: status,
          }),
        });
      }
    }

    if (priority !== undefined && priority !== currentTicket.priority) {
      updateData.priority = priority;
      activities.push({
        action: "PRIORITY_CHANGED",
        description: `Priority changed from ${currentTicket.priority} to ${priority}`,
        metadata: JSON.stringify({
          oldPriority: currentTicket.priority,
          newPriority: priority,
        }),
      });
    }

    if (assignedToId !== undefined && assignedToId !== currentTicket.assignedToId) {
      updateData.assignedToId = assignedToId;

      if (assignedToId) {
        const newAssignee = await prisma.user.findUnique({
          where: { id: assignedToId },
          select: { firstName: true, lastName: true },
        });
        activities.push({
          action: "ASSIGNED",
          description: `Ticket assigned to ${newAssignee?.firstName} ${newAssignee?.lastName}`,
          metadata: JSON.stringify({
            oldAssignedToId: currentTicket.assignedToId,
            newAssignedToId: assignedToId,
          }),
        });
      } else {
        activities.push({
          action: "UNASSIGNED",
          description: `Ticket unassigned from ${currentTicket.assignedTo?.firstName} ${currentTicket.assignedTo?.lastName}`,
          metadata: JSON.stringify({
            oldAssignedToId: currentTicket.assignedToId,
            newAssignedToId: null,
          }),
        });
      }
    }

    if (resolution !== undefined && resolution !== currentTicket.resolution) {
      updateData.resolution = resolution;
      activities.push({
        action: "UPDATED",
        description: `Resolution updated`,
        metadata: JSON.stringify({
          field: "resolution",
          oldValue: currentTicket.resolution,
          newValue: resolution,
        }),
      });
    }

    // Update ticket and create activities in transaction
    const updatedTicket = await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.update({
        where: { id: ticketId },
        data: updateData,
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

      // Create activity logs
      for (const activity of activities) {
        await tx.ticketActivity.create({
          data: {
            ticketId,
            userId: user.id,
            ...activity,
          },
        });
      }

      return ticket;
    });

    return NextResponse.json({
      success: true,
      data: updatedTicket,
    });
  } catch (error) {
    console.error("PATCH /api/tickets/[ticketId] error:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to update ticket" },
      { status: 500 }
    );
  }
}

// DELETE /api/tickets/[ticketId] - Delete ticket
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const user = await requirePermission(["orders.view"]);
    const { ticketId } = await params;

    // Only Admin can delete tickets
    if (!isAdmin(user.roleName)) {
      return NextResponse.json(
        { success: false, error: "Only administrators can delete tickets" },
        { status: 403 }
      );
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return NextResponse.json(
        { success: false, error: "Ticket not found" },
        { status: 404 }
      );
    }

    await prisma.ticket.delete({
      where: { id: ticketId },
    });

    return NextResponse.json({
      success: true,
      message: "Ticket deleted successfully",
    });
  } catch (error) {
    console.error("DELETE /api/tickets/[ticketId] error:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to delete ticket" },
      { status: 500 }
    );
  }
}
