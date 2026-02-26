import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface DetailPageStats {
  totalSales: number;
  totalOrderAmount: number;
  totalDeposits: number;
}

export interface DetailPageOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  buildingType: string;
  buildingSize: string;
  installer: string | null;
  deliveryState: string;
  totalPrice: Prisma.Decimal;
  depositAmount: Prisma.Decimal;
  depositCollected: boolean;
  dateSold: Date | null;
  sentToManufacturer: boolean;
  salesRep: { firstName: string; lastName: string } | null;
}

export async function getSalesRepByName(fullName: string) {
  const nameParts = fullName.split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ");
  return prisma.user.findFirst({
    where: { firstName, lastName },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      office: true,
      department: true,
      role: { select: { name: true } },
      isActive: true,
    },
  });
}

export async function getDetailStats(
  orderWhere: Prisma.OrderWhereInput
): Promise<DetailPageStats> {
  const [salesAgg, depositAgg] = await Promise.all([
    prisma.order.aggregate({
      where: { ...orderWhere, status: { not: "CANCELLED" } },
      _count: { id: true },
      _sum: { totalPrice: true },
    }),
    prisma.order.aggregate({
      where: {
        ...orderWhere,
        status: { not: "CANCELLED" },
        depositCollected: true,
      },
      _sum: { depositAmount: true },
    }),
  ]);

  return {
    totalSales: salesAgg._count.id,
    totalOrderAmount: salesAgg._sum.totalPrice?.toNumber() || 0,
    totalDeposits: depositAgg._sum.depositAmount?.toNumber() || 0,
  };
}

export async function getDetailOrders(
  orderWhere: Prisma.OrderWhereInput,
  take = 200
): Promise<DetailPageOrder[]> {
  return prisma.order.findMany({
    where: orderWhere,
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      buildingType: true,
      buildingSize: true,
      installer: true,
      deliveryState: true,
      totalPrice: true,
      depositAmount: true,
      depositCollected: true,
      dateSold: true,
      sentToManufacturer: true,
      salesRep: { select: { firstName: true, lastName: true } },
    },
    orderBy: { dateSold: "desc" },
    take,
  });
}

export function buildOrderWhere(
  filterType: "salesRep" | "state" | "manufacturer",
  value: string,
  salesRepId?: string
): Prisma.OrderWhereInput {
  if (filterType === "salesRep" && salesRepId) {
    return { salesRepId };
  }
  if (filterType === "state") {
    return { deliveryState: value };
  }
  if (filterType === "manufacturer") {
    return { installer: value };
  }
  return {};
}
