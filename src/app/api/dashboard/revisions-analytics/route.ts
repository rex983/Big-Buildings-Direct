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
      whereClause.revisionDate = {};
      if (startDate) {
        (whereClause.revisionDate as Record<string, Date>).gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1);
        (whereClause.revisionDate as Record<string, Date>).lt = end;
      }
    }

    // Aggregate by sales rep using groupBy
    const salesRepAgg = await prisma.revision.groupBy({
      by: ["salesRepId"],
      where: { ...whereClause, salesRepId: { not: null } },
      _count: { id: true },
      _sum: { newOrderTotal: true },
    });

    // Fetch sales rep names for the grouped IDs
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

    const salesRepData = salesRepAgg
      .filter((r) => r.salesRepId && salesRepMap.has(r.salesRepId))
      .map((r) => ({
        name: salesRepMap.get(r.salesRepId!)!,
        quantity: r._count.id,
        totalAmount: r._sum.newOrderTotal?.toNumber() || 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    // Aggregate by state — need to go through order relation, so use a lightweight fetch
    // (Prisma groupBy doesn't support grouping by relation fields)
    const stateRevisions = await prisma.revision.findMany({
      where: whereClause,
      select: {
        newOrderTotal: true,
        order: { select: { deliveryState: true } },
      },
    });

    const stateMap = new Map<string, { state: string; quantity: number; totalAmount: number }>();
    for (const rev of stateRevisions) {
      const state = rev.order?.deliveryState;
      if (!state) continue;
      const existing = stateMap.get(state) || { state, quantity: 0, totalAmount: 0 };
      existing.quantity += 1;
      existing.totalAmount += rev.newOrderTotal?.toNumber() || 0;
      stateMap.set(state, existing);
    }
    const stateData = Array.from(stateMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);

    // Aggregate by manufacturer — also needs relation/coalesce logic, use lightweight fetch
    const mfrRevisions = await prisma.revision.findMany({
      where: whereClause,
      select: {
        newOrderTotal: true,
        newManufacturer: true,
        originalManufacturer: true,
      },
    });

    const mfrMap = new Map<string, { manufacturer: string; quantity: number; totalAmount: number }>();
    for (const rev of mfrRevisions) {
      const manufacturer = rev.newManufacturer || rev.originalManufacturer;
      if (!manufacturer) continue;
      const existing = mfrMap.get(manufacturer) || { manufacturer, quantity: 0, totalAmount: 0 };
      existing.quantity += 1;
      existing.totalAmount += rev.newOrderTotal?.toNumber() || 0;
      mfrMap.set(manufacturer, existing);
    }
    const manufacturerData = Array.from(mfrMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);

    return NextResponse.json({
      success: true,
      data: {
        salesRep: salesRepData,
        state: stateData,
        manufacturer: manufacturerData,
      },
    });
  } catch (error) {
    console.error("Revisions analytics error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch revision analytics" },
      { status: 500 }
    );
  }
}
