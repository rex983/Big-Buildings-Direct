import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, isAdmin } from "@/lib/auth";
import { generateOrderNumber, parseQueryParams } from "@/lib/utils";
import { findOrCreateCustomer } from "@/lib/customers";

const createOrderSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email("Invalid email address"),
  customerPhone: z.string().optional(),
  buildingType: z.string().min(1, "Building type is required"),
  buildingSize: z.string().min(1, "Building size is required"),
  buildingColor: z.string().optional(),
  buildingOptions: z.any().optional(),
  deliveryAddress: z.string().min(1, "Delivery address is required"),
  deliveryCity: z.string().min(1, "City is required"),
  deliveryState: z.string().min(2).max(2, "Use state abbreviation"),
  deliveryZip: z.string().min(5, "ZIP code is required"),
  deliveryNotes: z.string().optional(),
  totalPrice: z.number().positive("Total price must be positive"),
  depositAmount: z.number().positive("Deposit amount must be positive"),
  customerId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission(["orders.view", "orders.view_all"]);
    const searchParams = request.nextUrl.searchParams;
    const { page, pageSize, search, sortBy, sortOrder } = parseQueryParams(searchParams);

    const canViewAll = isAdmin(user.roleName) || user.permissions.includes("orders.view_all");
    const baseWhere = canViewAll ? {} : { salesRepId: user.id };

    const status = searchParams.get("status");
    const statusFilter = status ? { status: status as "ACTIVE" | "COMPLETED" | "CANCELLED" | "ON_HOLD" } : {};

    const searchFilter = search
      ? {
          OR: [
            { orderNumber: { contains: search } },
            { customerName: { contains: search } },
            { customerEmail: { contains: search } },
          ],
        }
      : {};

    const where = { ...baseWhere, ...statusFilter, ...searchFilter };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          currentStage: true,
          salesRep: { select: { id: true, firstName: true, lastName: true } },
          customer: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: orders,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
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

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("orders.create");
    const body = await request.json();

    const validation = createOrderSchema.safeParse(body);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0].toString()] = err.message;
        }
      });
      return NextResponse.json(
        { success: false, errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Auto-link or create Customer user
    const customerId = await findOrCreateCustomer(
      data.customerEmail,
      data.customerName,
      data.customerPhone
    );

    // Get default stage
    const defaultStage = await prisma.orderStage.findFirst({
      where: { isDefault: true },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        buildingType: data.buildingType,
        buildingSize: data.buildingSize,
        buildingColor: data.buildingColor,
        buildingOptions: data.buildingOptions,
        deliveryAddress: data.deliveryAddress,
        deliveryCity: data.deliveryCity,
        deliveryState: data.deliveryState,
        deliveryZip: data.deliveryZip,
        deliveryNotes: data.deliveryNotes,
        totalPrice: data.totalPrice,
        depositAmount: data.depositAmount,
        salesRepId: user.id,
        customerId,
        currentStageId: defaultStage?.id,
        stageHistory: defaultStage
          ? {
              create: {
                stageId: defaultStage.id,
                changedById: user.id,
              },
            }
          : undefined,
        activities: {
          create: {
            type: "ORDER_CREATED",
            description: "Order was created",
            userId: user.id,
          },
        },
      },
      include: {
        currentStage: true,
      },
    });

    return NextResponse.json({ success: true, data: order }, { status: 201 });
  } catch (error) {
    console.error("POST /api/orders error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create order" },
      { status: 500 }
    );
  }
}
