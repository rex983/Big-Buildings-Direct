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

  const orders = await prisma.order.findMany({
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
    select: {
      salesRepId: true,
      totalPrice: true,
    },
  });

  const statsMap = new Map<string, { buildingsSold: number; totalOrderAmount: Prisma.Decimal }>();

  for (const order of orders) {
    if (!order.salesRepId) continue;
    const existing = statsMap.get(order.salesRepId) ?? {
      buildingsSold: 0,
      totalOrderAmount: new Prisma.Decimal(0),
    };
    existing.buildingsSold += 1;
    existing.totalOrderAmount = existing.totalOrderAmount.add(order.totalPrice);
    statsMap.set(order.salesRepId, existing);
  }

  return statsMap;
}

/**
 * Get ledger entries for a given month/year with rep info and pay plan line items.
 */
export async function getLedgerForMonth(month: number, year: number) {
  const ledgerEntries = await prisma.payLedger.findMany({
    where: { month, year },
    include: {
      salesRep: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
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
 * Generate/refresh ledger entries for all sales reps for a given month/year.
 * Preserves existing adjustments and approved status.
 */
export async function generateLedger(month: number, year: number, reviewerId: string) {
  const salesReps = await prisma.user.findMany({
    where: {
      role: { name: "Sales Rep" },
      isActive: true,
    },
    select: { id: true },
  });

  const orderStats = await getOrderStatsForMonth(month, year);

  const payPlans = await prisma.payPlan.findMany({
    where: { month, year },
    include: {
      lineItems: true,
    },
  });

  const planMap = new Map(payPlans.map((p) => [p.salesRepId, p]));

  const results = [];

  for (const rep of salesReps) {
    const stats = orderStats.get(rep.id) ?? {
      buildingsSold: 0,
      totalOrderAmount: new Prisma.Decimal(0),
    };

    const plan = planMap.get(rep.id);
    const planTotal = plan
      ? plan.lineItems.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0))
      : new Prisma.Decimal(0);

    // Check if entry already exists
    const existing = await prisma.payLedger.findUnique({
      where: {
        month_year_salesRepId: { month, year, salesRepId: rep.id },
      },
    });

    const adjustment = existing?.adjustment ?? new Prisma.Decimal(0);
    const finalAmount = planTotal.add(adjustment);

    // Preserve approved status - don't overwrite if already approved
    const status = existing?.status === "APPROVED" ? "APPROVED" : existing?.status ?? "PENDING";

    const ledgerEntry = await prisma.payLedger.upsert({
      where: {
        month_year_salesRepId: { month, year, salesRepId: rep.id },
      },
      update: {
        buildingsSold: stats.buildingsSold,
        totalOrderAmount: stats.totalOrderAmount,
        planTotal,
        finalAmount,
        // Preserve adjustment, adjustmentNote, notes, status, reviewedById, reviewedAt
      },
      create: {
        month,
        year,
        salesRepId: rep.id,
        buildingsSold: stats.buildingsSold,
        totalOrderAmount: stats.totalOrderAmount,
        planTotal,
        adjustment,
        finalAmount,
        status,
      },
    });

    results.push(ledgerEntry);
  }

  return results;
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
