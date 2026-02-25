import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;
    const isAdmin = user.roleName === "Admin";
    const canViewAll = user.permissions.includes("orders.view_all");

    if (!isAdmin && !canViewAll) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const filterType = searchParams.get("type"); // "salesRep" | "state" | "manufacturer"
    const filterValue = searchParams.get("value");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!filterType || !filterValue) {
      return NextResponse.json(
        { success: false, error: "type and value are required" },
        { status: 400 }
      );
    }

    const where: Prisma.OrderWhereInput = {};
    let salesRepId: string | null = null;

    if (filterType === "salesRep") {
      const nameParts = filterValue.split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ");
      const rep = await prisma.user.findFirst({
        where: { firstName, lastName },
        select: { id: true },
      });
      if (!rep) {
        return NextResponse.json({
          success: true,
          data: {
            totalSales: 0,
            totalOrderAmount: 0,
            totalDeposits: 0,
            totalRevisions: 0,
          },
        });
      }
      salesRepId = rep.id;
      where.salesRepId = rep.id;
    } else if (filterType === "state") {
      where.deliveryState = filterValue;
    } else if (filterType === "manufacturer") {
      where.installer = filterValue;
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid filter type" },
        { status: 400 }
      );
    }

    const dateFilter: Record<string, Date> = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      dateFilter.lt = end;
    }

    if (Object.keys(dateFilter).length > 0) {
      where.dateSold = dateFilter;
    }

    // Build revision-specific where clause
    const revisionWhere: Prisma.RevisionWhereInput = {};
    if (filterType === "salesRep" && salesRepId) {
      revisionWhere.salesRepId = salesRepId;
    } else if (filterType === "state") {
      revisionWhere.order = { deliveryState: filterValue };
    } else if (filterType === "manufacturer") {
      revisionWhere.OR = [
        { originalManufacturer: filterValue },
        { newManufacturer: filterValue },
      ];
    }
    if (Object.keys(dateFilter).length > 0) {
      revisionWhere.revisionDate = dateFilter;
    }

    // Run all aggregations in parallel
    const [salesAgg, depositAgg, revisionCount] = await Promise.all([
      prisma.order.aggregate({
        where: { ...where, status: { not: "CANCELLED" } },
        _count: { id: true },
        _sum: { totalPrice: true },
      }),
      prisma.order.aggregate({
        where: { ...where, status: { not: "CANCELLED" }, depositCollected: true },
        _sum: { depositAmount: true },
      }),
      prisma.revision.count({
        where: revisionWhere,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        totalSales: salesAgg._count.id,
        totalOrderAmount: salesAgg._sum.totalPrice?.toNumber() || 0,
        totalDeposits: depositAgg._sum.depositAmount?.toNumber() || 0,
        totalRevisions: revisionCount,
      },
    });
  } catch (error) {
    console.error("Dashboard drilldown error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch drilldown data" },
      { status: 500 }
    );
  }
}
