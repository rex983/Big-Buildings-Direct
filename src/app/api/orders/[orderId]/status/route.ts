import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, isAdmin } from "@/lib/auth";
import { getOrder, updateOrderField } from "@/lib/order-process";

// Boolean status fields (workflow checkboxes)
const booleanStatusFields = [
  "depositCollected",
  "sentToCustomer",
  "customerSigned",
  "sentToManufacturer",
] as const;

type BooleanStatusField = (typeof booleanStatusFields)[number];

const fieldLabels: Record<BooleanStatusField, string> = {
  depositCollected: "Deposit Collected",
  sentToCustomer: "Sent to Customer",
  customerSigned: "Customer Signed",
  sentToManufacturer: "Sent to Manufacturer",
};

const updateBooleanStatusSchema = z.object({
  field: z.enum(booleanStatusFields),
  value: z.boolean(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const user = await requirePermission(["orders.edit", "orders.view"]);
    const { orderId } = await params;

    const canEditStatus =
      isAdmin(user.roleName) ||
      user.roleName === "Manager" ||
      user.roleName === "BST" ||
      user.permissions.includes("orders.edit");

    if (!canEditStatus) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to edit order status" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const validation = updateBooleanStatusSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { field, value } = validation.data;

    // Check order exists
    const order = await getOrder(orderId);
    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    // Access check
    const canViewAll =
      isAdmin(user.roleName) ||
      user.roleName === "Manager" ||
      user.roleName === "BST" ||
      user.permissions.includes("orders.view_all");

    const userName = `${user.firstName} ${user.lastName}`;
    if (!canViewAll && order.salesPerson !== userName) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // Write back to Order Process's orders table
    await updateOrderField(orderId, field, value);

    return NextResponse.json({
      success: true,
      data: {
        field,
        value,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("PATCH /api/orders/[orderId]/status error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update status" },
      { status: 500 }
    );
  }
}
