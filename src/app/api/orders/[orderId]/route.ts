import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, isAdmin } from "@/lib/auth";

const updateOrderSchema = z.object({
  customerName: z.string().min(1).optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  buildingType: z.string().min(1).optional(),
  buildingSize: z.string().min(1).optional(),
  buildingColor: z.string().optional(),
  buildingOptions: z.record(z.unknown()).optional(),
  deliveryAddress: z.string().min(1).optional(),
  deliveryCity: z.string().min(1).optional(),
  deliveryState: z.string().min(2).max(2).optional(),
  deliveryZip: z.string().min(5).optional(),
  deliveryNotes: z.string().optional(),
  totalPrice: z.number().positive().optional(),
  depositAmount: z.number().positive().optional(),
  depositCollected: z.boolean().optional(),
  status: z.enum(["ACTIVE", "COMPLETED", "CANCELLED", "ON_HOLD"]).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  cancelReason: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const user = await requirePermission(["orders.view", "orders.view_all"]);
    const { orderId } = await params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        currentStage: true,
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
        salesRep: { select: { id: true, firstName: true, lastName: true } },
        stageHistory: {
          include: { stage: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    // Check access
    const canViewAll = isAdmin(user.roleName) || user.permissions.includes("orders.view_all");
    if (!canViewAll && order.salesRepId !== user.id) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error("GET /api/orders/[orderId] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch order" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const user = await requirePermission("orders.edit");
    const { orderId } = await params;
    const body = await request.json();

    const validation = updateOrderSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    // Check access
    const canViewAll = isAdmin(user.roleName) || user.permissions.includes("orders.view_all");
    if (!canViewAll && existingOrder.salesRepId !== user.id) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    const data = validation.data;

    // Handle status changes
    const updateData: Record<string, unknown> = { ...data };

    if (data.status === "COMPLETED" && existingOrder.status !== "COMPLETED") {
      updateData.completedAt = new Date();
    }
    if (data.status === "CANCELLED" && existingOrder.status !== "CANCELLED") {
      updateData.cancelledAt = new Date();
    }
    if (data.depositCollected === true && !existingOrder.depositCollected) {
      updateData.depositDate = new Date();
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: { currentStage: true },
    });

    // Log activity
    await prisma.orderActivity.create({
      data: {
        orderId,
        type: data.status && data.status !== existingOrder.status ? "STATUS_CHANGED" : "ORDER_UPDATED",
        description: data.status && data.status !== existingOrder.status
          ? `Status changed from ${existingOrder.status} to ${data.status}`
          : "Order details updated",
        userId: user.id,
      },
    });

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error("PATCH /api/orders/[orderId] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update order" },
      { status: 500 }
    );
  }
}
