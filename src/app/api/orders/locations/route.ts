import { NextResponse } from "next/server";
import { requirePermission, isAdmin } from "@/lib/auth";
import { getOrderLocations } from "@/lib/order-process";

export async function GET() {
  try {
    const user = await requirePermission("orders.view");

    const hasFullAccess =
      isAdmin(user.roleName) ||
      user.roleName === "Manager" ||
      user.permissions.includes("orders.view_all");

    const salesPerson = hasFullAccess
      ? undefined
      : `${user.firstName} ${user.lastName}`;

    const locations = await getOrderLocations({ salesPerson });

    return NextResponse.json({ success: true, data: locations });
  } catch (error) {
    console.error("GET /api/orders/locations error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch order locations" },
      { status: 500 }
    );
  }
}
