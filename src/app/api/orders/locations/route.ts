import { NextResponse } from "next/server";
import { requirePermission, isAdmin } from "@/lib/auth";
import { getOrderLocations, getOfficeSalesPersons } from "@/lib/order-process";

export async function GET() {
  try {
    const user = await requirePermission("orders.view");

    const isAdminUser = isAdmin(user.roleName);
    const isManager = user.roleName === "Manager";
    const canViewAll = user.permissions.includes("orders.view_all");

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

    const locations = await getOrderLocations({ salesPerson, salesPersons });

    return NextResponse.json({ success: true, data: locations });
  } catch (error) {
    console.error("GET /api/orders/locations error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch order locations" },
      { status: 500 }
    );
  }
}
