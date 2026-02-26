import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isAdmin } from "@/lib/auth";
import { getOrders, getOfficeSalesPersons } from "@/lib/order-process";
import type { OPOrderStatus } from "@/types/order-process";

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission(["orders.view", "orders.view_all"]);
    const searchParams = request.nextUrl.searchParams;

    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") as OPOrderStatus | null;

    const isAdminUser = isAdmin(user.roleName);
    const isManager = user.roleName === "Manager";
    const canViewAll = user.permissions.includes("orders.view_all");

    // Determine filter scope
    let salesPerson: string | undefined;
    let salesPersons: string[] | undefined;

    if (isAdminUser) {
      // Admin sees everything
    } else if (isManager && user.office) {
      salesPersons = await getOfficeSalesPersons(user.office);
    } else if (canViewAll) {
      // BST, R&D see everything
    } else {
      salesPerson = `${user.firstName} ${user.lastName}`;
    }

    const result = await getOrders({
      page,
      pageSize,
      search,
      status: status || undefined,
      salesPerson,
      salesPersons,
    });

    return NextResponse.json({
      success: true,
      data: {
        items: result.orders,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error("GET /api/orders error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

// Order creation is handled by the Order Process app.
// BBD does not create orders — it only displays them.
