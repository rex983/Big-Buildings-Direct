import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getOfficeSalesPersons } from "@/lib/order-process";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;
    const isAdmin = user.roleName === "Admin";
    const isManager = user.roleName === "Manager";
    const canViewAll = user.permissions.includes("orders.view_all");

    // Get date range from query params
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build Supabase query — fetch fields needed for aggregation
    let query = supabaseAdmin
      .from("orders")
      .select("sales_person, customer, building, pricing, created_at")
      .neq("status", "cancelled");

    // Permission filter:
    // - Admin: sees all
    // - Manager: sees their office's reps
    // - Others with view_all (BST, R&D): sees all
    // - Sales Rep: sees only their own
    if (isManager && user.office) {
      const officeReps = await getOfficeSalesPersons(user.office);
      if (officeReps.length > 0) {
        query = query.in("sales_person", officeReps);
      }
    } else if (!isAdmin && !canViewAll) {
      const salesPerson = `${user.firstName} ${user.lastName}`;
      query = query.eq("sales_person", salesPerson);
    }

    // Date filtering on created_at
    if (startDate) {
      query = query.gte("created_at", `${startDate}T00:00:00.000Z`);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      query = query.lt("created_at", end.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error("Analytics query error:", JSON.stringify(error));
      return NextResponse.json(
        { success: false, error: "Failed to fetch analytics" },
        { status: 500 }
      );
    }

    // Aggregate in JS
    const salesRepMap = new Map<string, { name: string; quantity: number; totalAmount: number }>();
    const stateMap = new Map<string, { state: string; quantity: number; totalAmount: number }>();
    const mfrMap = new Map<string, { manufacturer: string; quantity: number; totalAmount: number }>();

    for (const row of data || []) {
      const amount = row.pricing?.subtotalBeforeTax || 0;

      // Sales rep aggregation
      const rep = row.sales_person;
      if (rep) {
        const existing = salesRepMap.get(rep) || { name: rep, quantity: 0, totalAmount: 0 };
        existing.quantity += 1;
        existing.totalAmount += amount;
        salesRepMap.set(rep, existing);
      }

      // State aggregation
      const state = row.customer?.state;
      if (state) {
        const existing = stateMap.get(state) || { state, quantity: 0, totalAmount: 0 };
        existing.quantity += 1;
        existing.totalAmount += amount;
        stateMap.set(state, existing);
      }

      // Manufacturer aggregation
      const mfr = row.building?.manufacturer;
      if (mfr) {
        const existing = mfrMap.get(mfr) || { manufacturer: mfr, quantity: 0, totalAmount: 0 };
        existing.quantity += 1;
        existing.totalAmount += amount;
        mfrMap.set(mfr, existing);
      }
    }

    const salesRepData = Array.from(salesRepMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
    const stateData = Array.from(stateMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
    const manufacturerData = Array.from(mfrMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);

    return NextResponse.json({
      success: true,
      data: {
        salesRep: salesRepData,
        state: stateData,
        manufacturer: manufacturerData,
      },
    });
  } catch (error) {
    console.error("Dashboard analytics error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
