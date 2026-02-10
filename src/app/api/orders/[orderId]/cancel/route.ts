import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAdmin } from "@/lib/auth";

const cancelOrderSchema = z.object({
  reason: z.string().min(1, "Cancellation reason is required"),
  notes: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const user = await requireAuth();
    const { orderId } = await params;

    // Only Admin, Manager, BST can cancel orders
    const allowedRoles = ["Admin", "Manager", "BST"];
    if (!allowedRoles.includes(user.roleName)) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to cancel orders" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = cancelOrderSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { reason, notes } = validation.data;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, orderNumber: true },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    if (order.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, error: "Order is already cancelled" },
        { status: 400 }
      );
    }

    const cancelReason = notes ? `${reason} | ${notes}` : reason;

    const [updatedOrder] = await prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason,
        },
        include: { currentStage: true },
      }),
      prisma.orderActivity.create({
        data: {
          orderId,
          type: "CANCELLED",
          description: `Order cancelled: ${reason}`,
          userId: user.id,
          metadata: JSON.stringify({
            reason,
            notes: notes || null,
            cancelledBy: user.id,
            cancelledAt: new Date().toISOString(),
          }),
        },
      }),
    ]);

    return NextResponse.json({ success: true, data: updatedOrder });
  } catch (error) {
    console.error("POST /api/orders/[orderId]/cancel error:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to cancel order" },
      { status: 500 }
    );
  }
}
