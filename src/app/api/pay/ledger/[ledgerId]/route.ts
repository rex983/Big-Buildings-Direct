import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { createPayAuditLog } from "@/lib/queries/pay";

const patchSchema = z.object({
  adjustment: z.union([z.number(), z.string()]).optional(),
  adjustmentNote: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["PENDING", "REVIEWED", "APPROVED"]).optional(),
});

// PATCH /api/pay/ledger/[ledgerId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ledgerId: string }> }
) {
  try {
    const user = await requirePermission("pay.ledger.edit");

    const { ledgerId } = await params;

    const body = await request.json();
    const validation = patchSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { adjustment, adjustmentNote, notes, status } = validation.data;

    // Fetch existing entry
    const existing = await prisma.payLedger.findUnique({
      where: { id: ledgerId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Ledger entry not found" },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (adjustmentNote !== undefined) {
      updateData.adjustmentNote = adjustmentNote;
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    // Handle adjustment change -> recalculate finalAmount
    if (adjustment !== undefined) {
      const newAdjustment = new Prisma.Decimal(String(adjustment));
      updateData.adjustment = newAdjustment;
      updateData.finalAmount = existing.planTotal.add(newAdjustment);
    }

    // Handle status transitions
    if (status !== undefined) {
      updateData.status = status;

      if (status === "REVIEWED" || status === "APPROVED") {
        updateData.reviewedById = user.id;
        updateData.reviewedAt = new Date();
      }

      // Unapprove: go back to PENDING
      if (status === "PENDING") {
        updateData.reviewedById = null;
        updateData.reviewedAt = null;
      }
    }

    const updated = await prisma.payLedger.update({
      where: { id: ledgerId },
      data: updateData,
      include: {
        salesRep: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Audit log
    const repName = `${updated.salesRep.firstName} ${updated.salesRep.lastName}`;
    const changes: string[] = [];
    if (adjustment !== undefined) changes.push(`adjustment=$${adjustment}`);
    if (status !== undefined) changes.push(`status=${status}`);
    if (adjustmentNote !== undefined) changes.push("adjustmentNote updated");
    if (notes !== undefined) changes.push("notes updated");

    await createPayAuditLog(user.id, "LEDGER_ADJUSTED", `Updated ledger for ${repName} (${existing.month}/${existing.year}): ${changes.join(", ")}`, {
      ledgerId,
      salesRepId: existing.salesRepId,
      repName,
      month: existing.month,
      year: existing.year,
      changes: { adjustment, adjustmentNote, notes, status },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("PATCH /api/pay/ledger/[ledgerId] error:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to update ledger entry" },
      { status: 500 }
    );
  }
}
