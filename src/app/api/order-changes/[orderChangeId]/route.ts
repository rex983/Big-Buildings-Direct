import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

const updateOrderChangeSchema = z.object({
  changeDate: z.string().or(z.date()).optional(),
  oldOrderTotal: z.number().optional().nullable(),
  newOrderTotal: z.number().optional().nullable(),
  oldDepositTotal: z.number().optional().nullable(),
  newDepositTotal: z.number().optional().nullable(),
  orderTotalDiff: z.number().optional().nullable(),
  depositDiff: z.number().optional().nullable(),
  orderFormName: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  customerEmail: z.string().optional().nullable(),
  changeType: z.string().optional().nullable(),
  additionalNotes: z.string().optional().nullable(),
  uploadsUrl: z.string().optional().nullable(),
  depositCharged: z.string().optional().nullable(),
  sabrinaProcess: z.boolean().optional(),
  updatedInNewSale: z.boolean().optional(),
  rexProcess: z.string().optional().nullable(),
  salesRepId: z.string().optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderChangeId: string }> }
) {
  try {
    await requirePermission(["orders.view", "orders.view_all"]);
    const { orderChangeId } = await params;

    const orderChange = await prisma.orderChange.findUnique({
      where: { id: orderChangeId },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            customerEmail: true,
            customerPhone: true,
            buildingType: true,
            buildingSize: true,
            totalPrice: true,
            depositAmount: true,
          },
        },
        salesRep: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!orderChange) {
      return NextResponse.json(
        { success: false, error: "Order change not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: orderChange });
  } catch (error) {
    console.error("GET /api/order-changes/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch order change" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orderChangeId: string }> }
) {
  try {
    await requirePermission("orders.edit");
    const { orderChangeId } = await params;
    const body = await request.json();

    const validation = updateOrderChangeSchema.safeParse(body);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0].toString()] = err.message;
        }
      });
      return NextResponse.json({ success: false, errors }, { status: 400 });
    }

    const data = validation.data;

    // Check if order change exists
    const existing = await prisma.orderChange.findUnique({
      where: { id: orderChangeId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Order change not found" },
        { status: 404 }
      );
    }

    const orderChange = await prisma.orderChange.update({
      where: { id: orderChangeId },
      data: {
        ...(data.changeDate && { changeDate: new Date(data.changeDate) }),
        ...(data.oldOrderTotal !== undefined && { oldOrderTotal: data.oldOrderTotal }),
        ...(data.newOrderTotal !== undefined && { newOrderTotal: data.newOrderTotal }),
        ...(data.oldDepositTotal !== undefined && { oldDepositTotal: data.oldDepositTotal }),
        ...(data.newDepositTotal !== undefined && { newDepositTotal: data.newDepositTotal }),
        ...(data.orderTotalDiff !== undefined && { orderTotalDiff: data.orderTotalDiff }),
        ...(data.depositDiff !== undefined && { depositDiff: data.depositDiff }),
        ...(data.orderFormName !== undefined && { orderFormName: data.orderFormName }),
        ...(data.manufacturer !== undefined && { manufacturer: data.manufacturer }),
        ...(data.customerEmail !== undefined && { customerEmail: data.customerEmail }),
        ...(data.changeType !== undefined && { changeType: data.changeType }),
        ...(data.additionalNotes !== undefined && { additionalNotes: data.additionalNotes }),
        ...(data.uploadsUrl !== undefined && { uploadsUrl: data.uploadsUrl }),
        ...(data.depositCharged !== undefined && { depositCharged: data.depositCharged }),
        ...(data.sabrinaProcess !== undefined && { sabrinaProcess: data.sabrinaProcess }),
        ...(data.updatedInNewSale !== undefined && { updatedInNewSale: data.updatedInNewSale }),
        ...(data.rexProcess !== undefined && { rexProcess: data.rexProcess }),
        ...(data.salesRepId !== undefined && { salesRepId: data.salesRepId }),
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
          },
        },
        salesRep: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: orderChange });
  } catch (error) {
    console.error("PUT /api/order-changes/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update order change" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orderChangeId: string }> }
) {
  try {
    await requirePermission("orders.delete");
    const { orderChangeId } = await params;

    // Check if exists
    const existing = await prisma.orderChange.findUnique({
      where: { id: orderChangeId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Order change not found" },
        { status: 404 }
      );
    }

    await prisma.orderChange.delete({
      where: { id: orderChangeId },
    });

    return NextResponse.json({ success: true, message: "Order change deleted" });
  } catch (error) {
    console.error("DELETE /api/order-changes/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete order change" },
      { status: 500 }
    );
  }
}
