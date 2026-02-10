import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, isAdmin } from "@/lib/auth";

const advanceStageSchema = z.object({
  stageId: z.string().min(1, "Stage ID is required"),
  notes: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const user = await requirePermission("orders.advance_stage");
    const { orderId } = await params;
    const body = await request.json();

    const validation = advanceStageSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { stageId, notes } = validation.data;

    // Get order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { currentStage: true },
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

    // Verify stage exists
    const newStage = await prisma.orderStage.findUnique({
      where: { id: stageId },
    });

    if (!newStage) {
      return NextResponse.json(
        { success: false, error: "Stage not found" },
        { status: 404 }
      );
    }

    // Update order and create history entry
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Create stage history entry
      await tx.orderStageHistory.create({
        data: {
          orderId,
          stageId,
          notes,
          changedById: user.id,
        },
      });

      // Create activity
      await tx.orderActivity.create({
        data: {
          orderId,
          type: "STAGE_CHANGED",
          description: `Stage changed from "${order.currentStage?.name || "None"}" to "${newStage.name}"`,
          userId: user.id,
          metadata: JSON.stringify({ fromStageId: order.currentStageId, toStageId: stageId, notes }),
        },
      });

      // Update order
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          currentStageId: stageId,
          // If stage is final, mark as completed
          ...(newStage.isFinal
            ? { status: "COMPLETED", completedAt: new Date() }
            : {}),
        },
        include: { currentStage: true },
      });

      return updated;
    });

    return NextResponse.json({ success: true, data: updatedOrder });
  } catch (error) {
    console.error("POST /api/orders/[orderId]/stage error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to advance stage" },
      { status: 500 }
    );
  }
}
