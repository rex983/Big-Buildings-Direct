import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isAdmin } from "@/lib/auth";
import { getOrder, updateOrderField } from "@/lib/order-process";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const user = await requirePermission(["orders.view", "orders.view_all"]);
    const { orderId } = await params;

    const order = await getOrder(orderId);

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    // Access check: non-admins can only see orders where they are the sales person
    const canViewAll =
      isAdmin(user.roleName) || user.permissions.includes("orders.view_all");
    const userName = `${user.firstName} ${user.lastName}`;
    if (!canViewAll && order.salesPerson !== userName) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error("GET /api/orders/[orderId] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch order" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const user = await requirePermission("orders.edit");
    const { orderId } = await params;
    const body = await request.json();

    // Verify order exists
    const order = await getOrder(orderId);
    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    // Access check
    const canViewAll =
      isAdmin(user.roleName) || user.permissions.includes("orders.view_all");
    const userName = `${user.firstName} ${user.lastName}`;
    if (!canViewAll && order.salesPerson !== userName) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // Handle status checkbox updates (the primary write-back from BBD)
    const { field, value } = body;
    if (field && value !== undefined) {
      await updateOrderField(orderId, field, value);
      const updated = await getOrder(orderId);
      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json(
      { success: false, error: "No updateable fields provided" },
      { status: 400 }
    );
  } catch (error) {
    console.error("PATCH /api/orders/[orderId] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update order" },
      { status: 500 }
    );
  }
}
