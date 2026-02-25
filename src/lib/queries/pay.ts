import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * Get all sales reps with their pay plans and order stats for a given month/year.
 */
export async function getPayPlansForMonth(month: number, year: number) {
  // Get all users with Sales Rep role
  const salesReps = await prisma.user.findMany({
    where: {
      role: { name: "Sales Rep" },
      isActive: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      office: true,
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  // Get pay plans for this month
  const payPlans = await prisma.payPlan.findMany({
    where: { month, year },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
    },
  });

  const payPlanMap = new Map(payPlans.map((p) => [p.salesRepId, p]));

  // Get order stats per sales rep for the month
  const orderStats = await getOrderStatsForMonth(month, year);

  return salesReps.map((rep) => {
    const plan = payPlanMap.get(rep.id);
    return {
      ...rep,
      payPlan: plan ?? null,
      salary: plan?.salary ?? new Prisma.Decimal(0),
      orderStats: orderStats.get(rep.id) ?? { buildingsSold: 0, totalOrderAmount: new Prisma.Decimal(0) },
    };
  });
}

/**
 * Calculate order stats (buildings sold, total order amount) per sales rep for a month.
 * Uses dateSold if available, otherwise falls back to createdAt. Excludes CANCELLED.
 */
export async function getOrderStatsForMonth(month: number, year: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const grouped = await prisma.order.groupBy({
    by: ["salesRepId"],
    where: {
      status: { not: "CANCELLED" },
      salesRepId: { not: null },
      OR: [
        {
          dateSold: { gte: startDate, lt: endDate },
        },
        {
          dateSold: null,
          createdAt: { gte: startDate, lt: endDate },
        },
      ],
    },
    _count: { id: true },
    _sum: { totalPrice: true },
  });

  const statsMap = new Map<string, { buildingsSold: number; totalOrderAmount: Prisma.Decimal }>();

  for (const group of grouped) {
    if (!group.salesRepId) continue;
    statsMap.set(group.salesRepId, {
      buildingsSold: group._count.id,
      totalOrderAmount: group._sum.totalPrice ?? new Prisma.Decimal(0),
    });
  }

  return statsMap;
}

/**
 * Get ledger entries for a given month/year with rep info and pay plan line items.
 */
export async function getLedgerForMonth(month: number, year: number) {
  const ledgerEntries = await prisma.payLedger.findMany({
    where: { month, year, salesRep: { isActive: true } },
    include: {
      salesRep: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          office: true,
        },
      },
      reviewedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: {
      salesRep: { firstName: "asc" },
    },
  });

  // Also fetch pay plan line items for breakdown
  const payPlans = await prisma.payPlan.findMany({
    where: { month, year },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
    },
  });

  const planMap = new Map(payPlans.map((p) => [p.salesRepId, p]));

  return ledgerEntries.map((entry) => ({
    ...entry,
    payPlan: planMap.get(entry.salesRepId) ?? null,
  }));
}

/**
 * Find the matching tier for a given value from a list of tiers.
 * Returns the tier whose min/max range contains the value, or null.
 */
interface TierData {
  type: string;
  minValue: Prisma.Decimal;
  maxValue: Prisma.Decimal | null;
  bonusAmount: Prisma.Decimal;
  bonusType: string;
}

export function findMatchingTier(value: number | Prisma.Decimal, tiers: TierData[]): TierData | null {
  const numValue = typeof value === "number" ? value : value.toNumber();
  for (const tier of tiers) {
    const min = tier.minValue.toNumber();
    const max = tier.maxValue?.toNumber() ?? Infinity;
    if (numValue >= min && numValue <= max) {
      return tier;
    }
  }
  return null;
}

/**
 * Calculate the payroll formula for a single rep:
 * (Qty * tiered bonus amount) + (Salary/12) + (order total * tiered%) = planTotal
 */
export function calculateFormulaForRep(
  buildingsSold: number,
  totalOrderAmount: Prisma.Decimal,
  salary: Prisma.Decimal,
  tiers: TierData[]
) {
  const buildingSoldTiers = tiers.filter((t) => t.type === "BUILDINGS_SOLD");
  const orderTotalTiers = tiers.filter((t) => t.type === "ORDER_TOTAL");

  // Tier bonus: match buildingsSold to BUILDINGS_SOLD tier
  let tierBonusAmount = new Prisma.Decimal(0);
  const buildingTier = findMatchingTier(buildingsSold, buildingSoldTiers);
  if (buildingTier) {
    tierBonusAmount = new Prisma.Decimal(buildingsSold).mul(buildingTier.bonusAmount);
  }

  // Monthly salary: salary / 12
  const monthlySalary = salary.toNumber() > 0
    ? new Prisma.Decimal(salary.toNumber() / 12).toDecimalPlaces(2)
    : new Prisma.Decimal(0);

  // Commission: match totalOrderAmount to ORDER_TOTAL tier, then totalOrderAmount * (bonusAmount/100)
  let commissionAmount = new Prisma.Decimal(0);
  const orderTier = findMatchingTier(totalOrderAmount, orderTotalTiers);
  if (orderTier) {
    if (orderTier.bonusType === "PERCENTAGE") {
      commissionAmount = totalOrderAmount
        .mul(orderTier.bonusAmount)
        .div(100)
        .toDecimalPlaces(2);
    } else {
      commissionAmount = orderTier.bonusAmount;
    }
  }

  const planTotal = tierBonusAmount.add(monthlySalary).add(commissionAmount);

  return { tierBonusAmount, monthlySalary, commissionAmount, planTotal };
}

/**
 * Generate/refresh ledger entries for all sales reps for a given month/year.
 * Uses the payroll formula: (Qty * tiered bonus) + (Salary/12) + (order total * tiered%) = planTotal
 * finalAmount = planTotal - cancellationDeduction + adjustment
 * Preserves existing adjustments, cancellation deductions, and approved status.
 */
export async function generateLedger(month: number, year: number, reviewerId: string) {
  const salesReps = await prisma.user.findMany({
    where: {
      role: { name: "Sales Rep" },
      isActive: true,
    },
    select: { id: true, office: true },
  });

  const orderStats = await getOrderStatsForMonth(month, year);

  const payPlans = await prisma.payPlan.findMany({
    where: { month, year },
    include: {
      lineItems: true,
    },
  });

  const planMap = new Map(payPlans.map((p) => [p.salesRepId, p]));

  // Fetch office pay plan tiers
  const officePlans = await getOfficePayPlans(month, year);

  // Batch-fetch all existing ledger entries for this month in one query
  const existingEntries = await prisma.payLedger.findMany({
    where: { month, year },
  });
  const existingMap = new Map(existingEntries.map((e) => [e.salesRepId, e]));

  // Build all upserts and run them in parallel
  const upsertPromises = salesReps.map((rep) => {
    const stats = orderStats.get(rep.id) ?? {
      buildingsSold: 0,
      totalOrderAmount: new Prisma.Decimal(0),
    };

    const plan = planMap.get(rep.id);
    const salary = plan?.salary ?? new Prisma.Decimal(0);

    const officePlan = rep.office ? officePlans[rep.office] : null;
    const tiers: TierData[] = officePlan?.tiers ?? [];

    const formula = calculateFormulaForRep(
      stats.buildingsSold,
      stats.totalOrderAmount,
      salary,
      tiers
    );

    const existing = existingMap.get(rep.id);
    const adjustment = existing?.adjustment ?? new Prisma.Decimal(0);
    const cancellationDeduction = existing?.cancellationDeduction ?? new Prisma.Decimal(0);
    const finalAmount = formula.planTotal.sub(cancellationDeduction).add(adjustment);
    const status = existing?.status === "APPROVED" ? "APPROVED" : existing?.status ?? "PENDING";

    return prisma.payLedger.upsert({
      where: {
        month_year_salesRepId: { month, year, salesRepId: rep.id },
      },
      update: {
        buildingsSold: stats.buildingsSold,
        totalOrderAmount: stats.totalOrderAmount,
        tierBonusAmount: formula.tierBonusAmount,
        monthlySalary: formula.monthlySalary,
        commissionAmount: formula.commissionAmount,
        planTotal: formula.planTotal,
        finalAmount,
      },
      create: {
        month,
        year,
        salesRepId: rep.id,
        buildingsSold: stats.buildingsSold,
        totalOrderAmount: stats.totalOrderAmount,
        tierBonusAmount: formula.tierBonusAmount,
        monthlySalary: formula.monthlySalary,
        commissionAmount: formula.commissionAmount,
        planTotal: formula.planTotal,
        adjustment,
        cancellationDeduction,
        finalAmount,
        status,
      },
    });
  });

  return Promise.all(upsertPromises);
}

/**
 * Get cancelled orders for a given month, optionally filtered by sales rep.
 * Filters by cancelledAt within the month range.
 */
export async function getCancelledOrdersForMonth(
  month: number,
  year: number,
  salesRepId?: string
) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const where: Prisma.OrderWhereInput = {
    status: "CANCELLED",
    cancelledAt: { gte: startDate, lt: endDate },
  };

  if (salesRepId) {
    where.salesRepId = salesRepId;
  }

  return prisma.order.findMany({
    where,
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      totalPrice: true,
      cancelledAt: true,
      cancelReason: true,
      salesRep: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { cancelledAt: "desc" },
  });
}

/**
 * Get office-level tiered pay plans for a given month/year.
 * Returns a map of office name to their tiers.
 */
export async function getOfficePayPlans(month: number, year: number) {
  const plans = await prisma.officePayPlan.findMany({
    where: { month, year },
    include: {
      tiers: { orderBy: { sortOrder: "asc" } },
    },
  });

  const result: Record<string, typeof plans[0] | null> = {
    "Marion Office": null,
    "Harbor Office": null,
  };

  for (const plan of plans) {
    result[plan.office] = plan;
  }

  return result;
}

/**
 * Create a pay audit log entry.
 */
export async function createPayAuditLog(
  userId: string,
  action: string,
  description: string,
  metadata?: Record<string, unknown>
) {
  return prisma.payAuditLog.create({
    data: {
      userId,
      action,
      description,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

/**
 * Get pay audit log entries, most recent first.
 */
export async function getPayAuditLogs(limit = 50) {
  return prisma.payAuditLog.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
}
