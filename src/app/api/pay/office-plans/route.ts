import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { createPayAuditLog } from "@/lib/queries/pay";

const tierSchema = z.object({
  type: z.enum(["BUILDINGS_SOLD", "ORDER_TOTAL"]),
  minValue: z.union([z.number(), z.string()]).transform((v) => String(v)),
  maxValue: z
    .union([z.number(), z.string(), z.null()])
    .transform((v) => (v === null || v === "" ? null : String(v)))
    .nullable()
    .optional(),
  bonusAmount: z.union([z.number(), z.string()]).transform((v) => String(v)),
  bonusType: z.enum(["FLAT", "PERCENTAGE"]).default("FLAT"),
});

const upsertOfficePlanSchema = z.object({
  office: z.enum(["Marion Office", "Harbor Office"]),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000),
  tiers: z.array(tierSchema),
});

// PUT /api/pay/office-plans
export async function PUT(request: NextRequest) {
  try {
    const user = await requirePermission("pay.plan.edit");

    const body = await request.json();
    const validation = upsertOfficePlanSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { office, month, year, tiers } = validation.data;

    const result = await prisma.$transaction(async (tx) => {
      const plan = await tx.officePayPlan.upsert({
        where: {
          office_month_year: { office, month, year },
        },
        update: {},
        create: { office, month, year },
      });

      // Delete existing tiers and replace
      await tx.officePayPlanTier.deleteMany({
        where: { officePayPlanId: plan.id },
      });

      if (tiers.length > 0) {
        await tx.officePayPlanTier.createMany({
          data: tiers.map((tier, index) => ({
            officePayPlanId: plan.id,
            type: tier.type,
            minValue: tier.minValue,
            maxValue: tier.maxValue ?? null,
            bonusAmount: tier.bonusAmount,
            bonusType: tier.bonusType,
            sortOrder: index,
          })),
        });
      }

      return tx.officePayPlan.findUnique({
        where: { id: plan.id },
        include: {
          tiers: { orderBy: { sortOrder: "asc" } },
        },
      });
    });

    await createPayAuditLog(user.id, "OFFICE_TIERS_UPDATED", `Updated ${office} pay plan tiers (${tiers.length} tier(s)) for ${month}/${year}`, {
      office,
      tierCount: tiers.length,
      month,
      year,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("PUT /api/pay/office-plans error:", error);

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
      { success: false, error: "Failed to save office pay plan" },
      { status: 500 }
    );
  }
}
