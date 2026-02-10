import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { getLedgerForMonth } from "@/lib/queries/pay";

// GET /api/pay/ledger?month=X&year=Y
export async function GET(request: NextRequest) {
  try {
    await requirePermission("pay.ledger.view");

    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get("month") || "", 10);
    const year = parseInt(searchParams.get("year") || "", 10);

    if (!month || !year || month < 1 || month > 12) {
      return NextResponse.json(
        { success: false, error: "Valid month (1-12) and year are required" },
        { status: 400 }
      );
    }

    const data = await getLedgerForMonth(month, year);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/pay/ledger error:", error);

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
      { success: false, error: "Failed to fetch ledger" },
      { status: 500 }
    );
  }
}
