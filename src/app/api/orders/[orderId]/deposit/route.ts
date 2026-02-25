import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAdmin } from "@/lib/auth";
import { DepositChargeStatus } from "@/types";

const depositChargeStatusValues = Object.values(DepositChargeStatus) as [string, ...string[]];

const updateDepositSchema = z.object({
  depositChargeStatus: z.enum(depositChargeStatusValues).optional(),
  depositNotes: z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const user = await requireAuth();
    const { orderId } = await params;

    // Only Admin or Manager can update deposit status
    if (!isAdmin(user.roleName) && user.roleName !== "Manager") {
      return NextResponse.json(
        { success: false, error: "Only Admin or Manager can update deposit status" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = updateDepositSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { depositChargeStatus: newStatus, depositNotes } = validation.data;

    // Check order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        depositChargeStatus: true,
        depositCollected: true,
        depositDate: true,
        depositNotes: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    const descriptions: string[] = [];
    const metadata: Record<string, unknown> = { changedAt: new Date().toISOString() };

    // Handle depositChargeStatus change
    if (newStatus !== undefined) {
      updateData.depositChargeStatus = newStatus;
      metadata.oldStatus = order.depositChargeStatus;
      metadata.newStatus = newStatus;

      // Side effects based on new status
      // "Accepted/complete" statuses → depositCollected = true
      // Everything else → depositCollected = false
      switch (newStatus) {
        case DepositChargeStatus.CHARGED:
        case DepositChargeStatus.ACCEPTED_AFTER_DECLINE:
          updateData.depositCollected = true;
          updateData.depositDate = new Date();
          break;
        case DepositChargeStatus.DECLINED:
          updateData.depositCollected = false;
          updateData.depositDate = null;
          break;
        case DepositChargeStatus.REFUNDED:
          updateData.depositCollected = false;
          break;
        case DepositChargeStatus.READY:
          updateData.depositCollected = false;
          updateData.depositDate = null;
          break;
      }

      descriptions.push(
        `Deposit charge status changed from "${order.depositChargeStatus || "Not Set"}" to "${newStatus}"`
      );
    }

    // Handle depositNotes change
    if (depositNotes !== undefined) {
      updateData.depositNotes = depositNotes;
      metadata.oldNotes = order.depositNotes;
      metadata.newNotes = depositNotes;
      descriptions.push("Deposit notes updated");
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: "No changes provided" },
        { status: 400 }
      );
    }

    // Update order + create activity in transaction
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: updateData,
      });

      await tx.orderActivity.create({
        data: {
          orderId,
          type: "DEPOSIT_STATUS_CHANGED",
          description: descriptions.join(". "),
          userId: user.id,
          metadata: JSON.stringify(metadata),
        },
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        depositChargeStatus: newStatus ?? order.depositChargeStatus,
        depositNotes: depositNotes !== undefined ? depositNotes : order.depositNotes,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("PATCH /api/orders/[orderId]/deposit error:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to update deposit status" },
      { status: 500 }
    );
  }
}
