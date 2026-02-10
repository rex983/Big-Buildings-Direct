import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requirePermission("orders.view");

    const isAdmin = user.roleName === "Admin";
    const isManager = user.roleName === "Manager";
    const canViewAll = user.permissions.includes("orders.view_all");
    const hasFullAccess = isAdmin || isManager || canViewAll;

    const whereClause = hasFullAccess
      ? { status: { not: "CANCELLED" } as const }
      : { status: { not: "CANCELLED" } as const, salesRepId: user.id };

    const orders = await prisma.order.findMany({
      where: whereClause,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        buildingType: true,
        buildingSize: true,
        deliveryAddress: true,
        deliveryCity: true,
        deliveryState: true,
        deliveryZip: true,
        status: true,
        totalPrice: true,
        installer: true,
        dateSold: true,
        sentToManufacturer: true,
        salesRep: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: orders });
  } catch (error) {
    console.error("GET /api/orders/locations error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch order locations" },
      { status: 500 }
    );
  }
}
