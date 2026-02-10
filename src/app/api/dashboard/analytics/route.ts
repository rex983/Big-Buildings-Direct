import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;
    const isAdmin = user.roleName === "Admin";
    const canViewAll = user.permissions.includes("orders.view_all");

    // Get date range from query params
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build where clause
    const whereClause: Record<string, unknown> = isAdmin || canViewAll ? {} : { salesRepId: user.id };

    if (startDate || endDate) {
      whereClause.dateSold = {};
      if (startDate) {
        (whereClause.dateSold as Record<string, Date>).gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1);
        (whereClause.dateSold as Record<string, Date>).lt = end;
      }
    }

    // Use Prisma groupBy for efficient database-level aggregation
    const [stateAgg, manufacturerAgg, salesRepAgg] = await Promise.all([
      // State aggregation
      prisma.order.groupBy({
        by: ["deliveryState"],
        where: whereClause,
        _count: { id: true },
        _sum: { totalPrice: true },
      }),

      // Manufacturer aggregation
      prisma.order.groupBy({
        by: ["installer"],
        where: whereClause,
        _count: { id: true },
        _sum: { totalPrice: true },
      }),

      // Sales Rep aggregation
      prisma.order.groupBy({
        by: ["salesRepId"],
        where: whereClause,
        _count: { id: true },
        _sum: { totalPrice: true },
      }),
    ]);

    // Get sales rep names in one query
    const salesRepIds = salesRepAgg
      .map((r) => r.salesRepId)
      .filter((id): id is string => id !== null);

    const salesReps = salesRepIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: salesRepIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];

    const salesRepMap = new Map(salesReps.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

    // Format state data (filter out nulls)
    const stateData = stateAgg
      .filter((row) => row.deliveryState)
      .map((row) => ({
        state: row.deliveryState!.toUpperCase(),
        quantity: row._count.id,
        totalAmount: row._sum.totalPrice?.toNumber() || 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    // Format manufacturer data (filter out nulls)
    const manufacturerData = manufacturerAgg
      .filter((row) => row.installer)
      .map((row) => ({
        manufacturer: row.installer!,
        quantity: row._count.id,
        totalAmount: row._sum.totalPrice?.toNumber() || 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    // Format sales rep data (filter out nulls)
    const salesRepData = salesRepAgg
      .filter((row) => row.salesRepId && salesRepMap.has(row.salesRepId))
      .map((row) => ({
        name: salesRepMap.get(row.salesRepId!)!,
        quantity: row._count.id,
        totalAmount: row._sum.totalPrice?.toNumber() || 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    return NextResponse.json({
      success: true,
      data: {
        salesRep: salesRepData,
        state: stateData,
        manufacturer: manufacturerData,
      },
    });
  } catch (error) {
    console.error("Dashboard analytics error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
