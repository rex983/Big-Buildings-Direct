import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { getPayPlansForMonth, createPayAuditLog } from "@/lib/queries/pay";

// GET /api/pay/plans?month=X&year=Y
export async function GET(request: NextRequest) {
  try {
    await requirePermission("pay.plan.view");

    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get("month") || "", 10);
    const year = parseInt(searchParams.get("year") || "", 10);

    if (!month || !year || month < 1 || month > 12) {
      return NextResponse.json(
        { success: false, error: "Valid month (1-12) and year are required" },
        { status: 400 }
      );
    }

    const data = await getPayPlansForMonth(month, year);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/pay/plans error:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to fetch pay plans" },
      { status: 500 }
    );
  }
}

const lineItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  amount: z.union([z.number(), z.string()]).transform((v) => String(v)),
});

const upsertPlanSchema = z.object({
  salesRepId: z.string().min(1, "Sales rep ID is required"),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000),
  salary: z.union([z.number(), z.string()]).transform((v) => String(v)).optional(),
  cancellationDeduction: z.union([z.number(), z.string()]).transform((v) => String(v)).optional(),
  lineItems: z.array(lineItemSchema).optional().default([]),
});

// PUT /api/pay/plans
export async function PUT(request: NextRequest) {
  try {
    const user = await requirePermission("pay.plan.edit");

    const body = await request.json();
    const validation = upsertPlanSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { salesRepId, month, year, lineItems, salary, cancellationDeduction } = validation.data;

    // Verify sales rep exists
    const salesRep = await prisma.user.findUnique({
      where: { id: salesRepId },
      select: { id: true },
    });

    if (!salesRep) {
      return NextResponse.json(
        { success: false, error: "Sales rep not found" },
        { status: 404 }
      );
    }

    // Upsert pay plan and replace all line items in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const plan = await tx.payPlan.upsert({
        where: {
          month_year_salesRepId: { month, year, salesRepId },
        },
        update: {
          createdById: user.id,
          ...(salary !== undefined ? { salary } : {}),
          ...(cancellationDeduction !== undefined ? { cancellationDeduction } : {}),
        },
        create: {
          month,
          year,
          salesRepId,
          createdById: user.id,
          salary: salary ?? "0",
          cancellationDeduction: cancellationDeduction ?? "0",
        },
      });

      // Delete existing line items
      await tx.payPlanLineItem.deleteMany({
        where: { payPlanId: plan.id },
      });

      // Create new line items
      if (lineItems.length > 0) {
        await tx.payPlanLineItem.createMany({
          data: lineItems.map((item, index) => ({
            payPlanId: plan.id,
            name: item.name,
            amount: item.amount,
            sortOrder: index,
          })),
        });
      }

      // Return with line items
      return tx.payPlan.findUnique({
        where: { id: plan.id },
        include: {
          lineItems: { orderBy: { sortOrder: "asc" } },
        },
      });
    });

    // Audit log
    const repInfo = await prisma.user.findUnique({
      where: { id: salesRepId },
      select: { firstName: true, lastName: true },
    });
    const repName = repInfo ? `${repInfo.firstName} ${repInfo.lastName}` : salesRepId;

    if (salary !== undefined) {
      await createPayAuditLog(user.id, "SALARY_UPDATED", `Updated salary for ${repName} to $${salary} (${month}/${year})`, {
        salesRepId,
        repName,
        salary,
        month,
        year,
      });
    }
    if (cancellationDeduction !== undefined) {
      await createPayAuditLog(user.id, "CANCELLATION_UPDATED", `Updated cancellation deduction for ${repName} to $${cancellationDeduction} (${month}/${year})`, {
        salesRepId,
        repName,
        cancellationDeduction,
        month,
        year,
      });
    }
    if (lineItems.length > 0) {
      await createPayAuditLog(user.id, "LINE_ITEMS_UPDATED", `Updated ${lineItems.length} line item(s) for ${repName} (${month}/${year})`, {
        salesRepId,
        repName,
        lineItemCount: lineItems.length,
        month,
        year,
      });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("PUT /api/pay/plans error:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to save pay plan" },
      { status: 500 }
    );
  }
}
