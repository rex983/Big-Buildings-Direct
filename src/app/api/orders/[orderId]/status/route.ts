import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, isAdmin } from "@/lib/auth";

// Boolean status fields (original)
const booleanStatusFields = [
  "depositCollected",
  "sentToCustomer",
  "customerSigned",
  "sentToManufacturer",
] as const;

type BooleanStatusField = (typeof booleanStatusFields)[number];

// String status fields (BST workflow)
const stringStatusFields = ["wcStatus", "lppStatus"] as const;

type StringStatusField = (typeof stringStatusFields)[number];

// All fields combined
const allStatusFields = [...booleanStatusFields, ...stringStatusFields] as const;

type StatusField = BooleanStatusField | StringStatusField;

const booleanDateFieldMapping: Record<BooleanStatusField, string> = {
  depositCollected: "depositDate",
  sentToCustomer: "sentToCustomerDate",
  customerSigned: "customerSignedDate",
  sentToManufacturer: "sentToManufacturerDate",
};

const stringDateFieldMapping: Record<StringStatusField, string> = {
  wcStatus: "wcStatusDate",
  lppStatus: "lppStatusDate",
};

const fieldLabels: Record<StatusField, string> = {
  depositCollected: "Deposit Collected",
  sentToCustomer: "Sent to Customer",
  customerSigned: "Customer Signed",
  sentToManufacturer: "Sent to Manufacturer",
  wcStatus: "WC Status",
  lppStatus: "LP&P Status",
};

// Valid values for string status fields
const wcStatusValues = ["Pending", "No Contact Made", "Contact Made"] as const;
const lppStatusValues = ["Pending", "Ready for Install"] as const;

// Schema for boolean fields
const updateBooleanStatusSchema = z.object({
  field: z.enum(booleanStatusFields),
  value: z.boolean(),
});

// Schema for string fields
const updateStringStatusSchema = z.object({
  field: z.enum(stringStatusFields),
  value: z.string().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const user = await requirePermission(["orders.edit", "orders.view"]);
    const { orderId } = await params;

    // Role check: Admin, Manager, BST, or has orders.edit permission
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
    const { field } = body;

    // Determine if this is a boolean or string field
    const isBooleanField = booleanStatusFields.includes(field);
    const isStringField = stringStatusFields.includes(field);

    if (!isBooleanField && !isStringField) {
      return NextResponse.json(
        { success: false, error: `Invalid field: ${field}` },
        { status: 400 }
      );
    }

    // Validate based on field type
    if (isBooleanField) {
      const validation = updateBooleanStatusSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { success: false, error: validation.error.errors[0].message },
          { status: 400 }
        );
      }
    } else {
      const validation = updateStringStatusSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { success: false, error: validation.error.errors[0].message },
          { status: 400 }
        );
      }

      // Validate string values
      const { value } = body;
      if (value !== null) {
        if (field === "wcStatus" && !wcStatusValues.includes(value)) {
          return NextResponse.json(
            { success: false, error: `Invalid wcStatus value: ${value}` },
            { status: 400 }
          );
        }
        if (field === "lppStatus" && !lppStatusValues.includes(value)) {
          return NextResponse.json(
            { success: false, error: `Invalid lppStatus value: ${value}` },
            { status: 400 }
          );
        }
      }
    }

    const { value } = body;

    // Check order exists and user has access
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        salesRepId: true,
        depositCollected: true,
        sentToCustomer: true,
        customerSigned: true,
        sentToManufacturer: true,
        wcStatus: true,
        lppStatus: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    // Check access - admin/manager/BST can edit all, others only their own orders
    const canViewAll =
      isAdmin(user.roleName) ||
      user.roleName === "Manager" ||
      user.roleName === "BST" ||
      user.permissions.includes("orders.view_all");

    if (!canViewAll && order.salesRepId !== user.id) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    const oldValue = order[field as keyof typeof order];
    const dateField = isBooleanField
      ? booleanDateFieldMapping[field as BooleanStatusField]
      : stringDateFieldMapping[field as StringStatusField];
    const activityType = isStringField ? "BST_STATUS_CHANGED" : "STATUS_CHANGED";

    // Update order with transaction to ensure consistency
    await prisma.$transaction(async (tx) => {
      // Update the status field and corresponding date field
      const updateData: Record<string, unknown> = {
        [field]: value,
      };

      // For boolean fields: set date when true, clear when false
      // For string fields: set date when value is set, clear when null
      if (isBooleanField) {
        if (value) {
          updateData[dateField] = new Date();
        } else {
          updateData[dateField] = null;
        }
      } else {
        // String field - always update date when value changes
        updateData[dateField] = value !== null ? new Date() : null;
      }

      await tx.order.update({
        where: { id: orderId },
        data: updateData,
      });

      // Create audit log entry
      const description = isBooleanField
        ? `${fieldLabels[field as StatusField]} changed from ${oldValue ? "Yes" : "No"} to ${value ? "Yes" : "No"}`
        : `${fieldLabels[field as StatusField]} changed from "${oldValue || "Not Set"}" to "${value || "Not Set"}"`;

      await tx.orderActivity.create({
        data: {
          orderId,
          type: activityType,
          description,
          userId: user.id,
          metadata: JSON.stringify({
            field,
            oldValue,
            newValue: value,
            changedAt: new Date().toISOString(),
          }),
        },
      });
    });

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

    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to update status" },
      { status: 500 }
    );
  }
}
