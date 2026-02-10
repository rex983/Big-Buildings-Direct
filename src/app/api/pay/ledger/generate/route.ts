import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { generateLedger, createPayAuditLog } from "@/lib/queries/pay";

const generateSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000),
});

// POST /api/pay/ledger/generate
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("pay.ledger.edit");

    const body = await request.json();
    const validation = generateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { month, year } = validation.data;
    const results = await generateLedger(month, year, user.id);

    await createPayAuditLog(user.id, "LEDGER_GENERATED", `Generated ${results.length} ledger entries for ${month}/${year}`, {
      month,
      year,
      entryCount: results.length,
    });

    return NextResponse.json({
      success: true,
      data: results,
      message: `Generated ${results.length} ledger entries`,
    });
  } catch (error) {
    console.error("POST /api/pay/ledger/generate error:", error);

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
      { success: false, error: "Failed to generate ledger" },
      { status: 500 }
    );
  }
}
