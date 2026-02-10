import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, isAdmin } from "@/lib/auth";

const createMessageSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  content: z.string().min(1, "Message content is required"),
  isInternal: z.boolean().default(false),
  parentId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("messages.view");
    const searchParams = request.nextUrl.searchParams;
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Order ID is required" },
        { status: 400 }
      );
    }

    // Check order access
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    const canViewAll = isAdmin(user.roleName) || user.permissions.includes("orders.view_all");
    if (!canViewAll && order.salesRepId !== user.id && order.customerId !== user.id) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    const canViewInternal = isAdmin(user.roleName) || user.permissions.includes("messages.view_internal");

    const messages = await prisma.message.findMany({
      where: {
        orderId,
        ...(canViewInternal ? {} : { isInternal: false }),
      },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: messages });
  } catch (error) {
    console.error("GET /api/messages error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("messages.send");
    const body = await request.json();

    const validation = createMessageSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { orderId, content, isInternal, parentId } = validation.data;

    // Check order access
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    const canViewAll = isAdmin(user.roleName) || user.permissions.includes("orders.view_all");
    if (!canViewAll && order.salesRepId !== user.id && order.customerId !== user.id) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // Only staff can send internal messages
    const canSendInternal = isAdmin(user.roleName) || user.permissions.includes("messages.view_internal");
    const messageIsInternal = canSendInternal && isInternal;

    const message = await prisma.message.create({
      data: {
        orderId,
        content,
        isInternal: messageIsInternal,
        senderId: user.id,
        parentId,
      },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
    });

    // Log activity
    await prisma.orderActivity.create({
      data: {
        orderId,
        type: "MESSAGE_SENT",
        description: messageIsInternal ? "Internal message sent" : "Message sent",
        userId: user.id,
      },
    });

    return NextResponse.json({ success: true, data: message }, { status: 201 });
  } catch (error) {
    console.error("POST /api/messages error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send message" },
      { status: 500 }
    );
  }
}
