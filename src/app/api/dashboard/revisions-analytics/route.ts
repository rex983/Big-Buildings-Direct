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

    // Query change_orders from Supabase (the OP equivalent of revisions)
    let query = supabaseAdmin
      .from("change_orders")
      .select("order_id, order_number, new_values, previous_values, new_customer, new_building, status, created_at")
      .neq("status", "cancelled");

    if (startDate) {
      query = query.gte("created_at", `${startDate}T00:00:00.000Z`);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      query = query.lt("created_at", end.toISOString());
    }

    const { data: changeOrders, error: coError } = await query;

    if (coError) {
      console.error("Revisions analytics query error:", JSON.stringify(coError));
      return NextResponse.json(
        { success: false, error: "Failed to fetch revision analytics" },
        { status: 500 }
      );
    }

    // If there are change orders, look up the parent orders for sales_person, state, manufacturer
    const orderIds = [...new Set((changeOrders || []).map((co) => co.order_id))];

    let ordersMap = new Map<string, { sales_person: string; state: string; manufacturer: string }>();

    if (orderIds.length > 0) {
      const { data: orders } = await supabaseAdmin
        .from("orders")
        .select("id, sales_person, customer, building")
        .in("id", orderIds);

      for (const o of orders || []) {
        ordersMap.set(o.id, {
          sales_person: o.sales_person || "",
          state: o.customer?.state || "",
          manufacturer: o.building?.manufacturer || "",
        });
      }
    }

    // Permission filter — determine allowed sales persons
    let allowedReps: Set<string> | null = null; // null = no filter (sees all)
    if (isManager && user.office) {
      const officeReps = await getOfficeSalesPersons(user.office);
      allowedReps = new Set(officeReps);
    } else if (!isAdmin && !canViewAll) {
      allowedReps = new Set([`${user.firstName} ${user.lastName}`]);
    }

    // Aggregate
    const salesRepMap = new Map<string, { name: string; quantity: number; totalAmount: number }>();
    const stateMap = new Map<string, { state: string; quantity: number; totalAmount: number }>();
    const mfrMap = new Map<string, { manufacturer: string; quantity: number; totalAmount: number }>();

    for (const co of changeOrders || []) {
      const parent = ordersMap.get(co.order_id);
      if (!parent) continue;
      if (allowedReps && !allowedReps.has(parent.sales_person)) continue;

      const amount = co.new_values?.subtotalBeforeTax || co.previous_values?.subtotalBeforeTax || 0;

      // Sales rep
      const rep = parent.sales_person;
      if (rep) {
        const existing = salesRepMap.get(rep) || { name: rep, quantity: 0, totalAmount: 0 };
        existing.quantity += 1;
        existing.totalAmount += amount;
        salesRepMap.set(rep, existing);
      }

      // State (prefer change order's new customer, fall back to parent order)
      const state = co.new_customer?.state || parent.state;
      if (state) {
        const existing = stateMap.get(state) || { state, quantity: 0, totalAmount: 0 };
        existing.quantity += 1;
        existing.totalAmount += amount;
        stateMap.set(state, existing);
      }

      // Manufacturer
      const mfr = co.new_building?.manufacturer || parent.manufacturer;
      if (mfr) {
        const existing = mfrMap.get(mfr) || { manufacturer: mfr, quantity: 0, totalAmount: 0 };
        existing.quantity += 1;
        existing.totalAmount += amount;
        mfrMap.set(mfr, existing);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        salesRep: Array.from(salesRepMap.values()).sort((a, b) => b.totalAmount - a.totalAmount),
        state: Array.from(stateMap.values()).sort((a, b) => b.totalAmount - a.totalAmount),
        manufacturer: Array.from(mfrMap.values()).sort((a, b) => b.totalAmount - a.totalAmount),
      },
    });
  } catch (error) {
    console.error("Revisions analytics error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch revision analytics" },
      { status: 500 }
    );
  }
}
