import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

export async function GET() {
  try {
    await requirePermission("orders.view");

    const orders = await prisma.order.findMany({
      where: {
        status: { not: "CANCELLED" },
      },
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
