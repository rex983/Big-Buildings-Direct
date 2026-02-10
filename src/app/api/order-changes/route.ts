import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, isAdmin } from "@/lib/auth";
import { parseQueryParams } from "@/lib/utils";

const createOrderChangeSchema = z.object({
  orderId: z.string().min(1, "Order is required"),
  changeDate: z.string().or(z.date()),
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

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission(["orders.view", "orders.view_all"]);
    const searchParams = request.nextUrl.searchParams;
    const { page, pageSize, search, sortBy, sortOrder } = parseQueryParams(searchParams);

    const canViewAll = isAdmin(user.roleName) || user.permissions.includes("orders.view_all");
    const baseWhere = canViewAll ? {} : { salesRepId: user.id };

    const changeType = searchParams.get("changeType");
    const changeTypeFilter = changeType ? { changeType } : {};

    const depositCharged = searchParams.get("depositCharged");
    const depositChargedFilter = depositCharged ? { depositCharged } : {};

    const searchFilter = search
      ? {
          OR: [
            { order: { orderNumber: { contains: search } } },
            { order: { customerName: { contains: search } } },
            { orderFormName: { contains: search } },
            { additionalNotes: { contains: search } },
            { customerEmail: { contains: search } },
          ],
        }
      : {};

    const where = { ...baseWhere, ...changeTypeFilter, ...depositChargedFilter, ...searchFilter };

    const orderByField = sortBy === "createdAt" ? "changeDate" : sortBy;

    const [orderChanges, total] = await Promise.all([
      prisma.orderChange.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              customerName: true,
              customerEmail: true,
            },
          },
          salesRep: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { [orderByField]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.orderChange.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: orderChanges,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("GET /api/order-changes error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch order changes" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("orders.edit");
    const body = await request.json();

    const validation = createOrderChangeSchema.safeParse(body);
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

    // Verify order exists
    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    const orderChange = await prisma.orderChange.create({
      data: {
        orderId: data.orderId,
        changeDate: new Date(data.changeDate),
        oldOrderTotal: data.oldOrderTotal,
        newOrderTotal: data.newOrderTotal,
        oldDepositTotal: data.oldDepositTotal,
        newDepositTotal: data.newDepositTotal,
        orderTotalDiff: data.orderTotalDiff,
        depositDiff: data.depositDiff,
        orderFormName: data.orderFormName,
        manufacturer: data.manufacturer,
        customerEmail: data.customerEmail,
        changeType: data.changeType,
        additionalNotes: data.additionalNotes,
        uploadsUrl: data.uploadsUrl,
        depositCharged: data.depositCharged,
        sabrinaProcess: data.sabrinaProcess ?? false,
        updatedInNewSale: data.updatedInNewSale ?? false,
        rexProcess: data.rexProcess,
        salesRepId: data.salesRepId || user.id,
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

    return NextResponse.json({ success: true, data: orderChange }, { status: 201 });
  } catch (error) {
    console.error("POST /api/order-changes error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create order change" },
      { status: 500 }
    );
  }
}
