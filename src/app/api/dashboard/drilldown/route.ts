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

    if (!isAdmin && !isManager && !canViewAll) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const filterType = searchParams.get("type"); // "salesRep" | "state" | "manufacturer"
    const filterValue = searchParams.get("value");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!filterType || !filterValue) {
      return NextResponse.json(
        { success: false, error: "type and value are required" },
        { status: 400 }
      );
    }

    // Determine office-scoped reps for managers
    let officeReps: string[] | null = null;
    if (isManager && user.office) {
      officeReps = await getOfficeSalesPersons(user.office);
    }

    // Fetch orders from Supabase
    let query = supabaseAdmin
      .from("orders")
      .select("sales_person, customer, building, pricing, payment, paid_at, status, created_at")
      .neq("status", "cancelled");

    // Apply dimension filter
    if (filterType === "salesRep") {
      query = query.eq("sales_person", filterValue);
    }
    if (filterType === "state") {
      query = query.eq("customer->>state", filterValue);
    }
    if (filterType === "manufacturer") {
      query = query.eq("building->>manufacturer", filterValue);
    }

    // Apply office scope for managers
    if (officeReps) {
      query = query.in("sales_person", officeReps);
    }

    // Date filtering
    if (startDate) {
      query = query.gte("created_at", `${startDate}T00:00:00.000Z`);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      query = query.lt("created_at", end.toISOString());
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error("Drilldown query error:", JSON.stringify(error));
      return NextResponse.json(
        { success: false, error: "Failed to fetch drilldown data" },
        { status: 500 }
      );
    }

    // Aggregate
    let totalSales = 0;
    let totalOrderAmount = 0;
    let totalDeposits = 0;

    for (const row of orders || []) {
      totalSales += 1;
      totalOrderAmount += row.pricing?.subtotalBeforeTax || 0;

      const depositPaid =
        row.payment?.status === "paid" ||
        row.payment?.status === "manually_approved" ||
        !!row.paid_at;
      if (depositPaid) {
        totalDeposits += row.pricing?.deposit || 0;
      }
    }

    // Count change orders (revisions) for this filter
    let totalRevisions = 0;
    if (orders && orders.length > 0) {
      let idQuery = supabaseAdmin
        .from("orders")
        .select("id")
        .neq("status", "cancelled");

      if (filterType === "salesRep") {
        idQuery = idQuery.eq("sales_person", filterValue);
      }
      if (filterType === "state") {
        idQuery = idQuery.eq("customer->>state", filterValue);
      }
      if (filterType === "manufacturer") {
        idQuery = idQuery.eq("building->>manufacturer", filterValue);
      }
      if (officeReps) {
        idQuery = idQuery.in("sales_person", officeReps);
      }
      if (startDate) {
        idQuery = idQuery.gte("created_at", `${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1);
        idQuery = idQuery.lt("created_at", end.toISOString());
      }

      const { data: orderIds } = await idQuery;
      const ids = (orderIds || []).map((o) => o.id);

      if (ids.length > 0) {
        const { count } = await supabaseAdmin
          .from("change_orders")
          .select("*", { count: "exact", head: true })
          .in("order_id", ids)
          .neq("status", "cancelled");
        totalRevisions = count || 0;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        totalSales,
        totalOrderAmount,
        totalDeposits,
        totalRevisions,
      },
    });
  } catch (error) {
    console.error("Dashboard drilldown error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch drilldown data" },
      { status: 500 }
    );
  }
}
