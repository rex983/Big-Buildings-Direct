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

    // Get revisions with related order data for state aggregation
    const revisions = await prisma.revision.findMany({
      where: whereClause,
      select: {
        id: true,
        newOrderTotal: true,
        salesRepId: true,
        newManufacturer: true,
        originalManufacturer: true,
        order: {
          select: {
            deliveryState: true,
          },
        },
      },
    });

    // Get sales rep names
    const salesRepIds = [...new Set(revisions.map((r) => r.salesRepId).filter((id): id is string => id !== null))];
    const salesReps = salesRepIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: salesRepIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const salesRepMap = new Map(salesReps.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

    // Aggregate by Sales Rep
    const salesRepAgg = new Map<string, { name: string; quantity: number; totalAmount: number }>();
    revisions.forEach((rev) => {
      if (rev.salesRepId && salesRepMap.has(rev.salesRepId)) {
        const name = salesRepMap.get(rev.salesRepId)!;
        const existing = salesRepAgg.get(rev.salesRepId) || { name, quantity: 0, totalAmount: 0 };
        existing.quantity += 1;
        existing.totalAmount += rev.newOrderTotal?.toNumber() || 0;
        salesRepAgg.set(rev.salesRepId, existing);
      }
    });

    // Aggregate by State (from related order)
    const stateAgg = new Map<string, { state: string; quantity: number; totalAmount: number }>();
    revisions.forEach((rev) => {
      const state = rev.order?.deliveryState?.toUpperCase();
      if (state) {
        const existing = stateAgg.get(state) || { state, quantity: 0, totalAmount: 0 };
        existing.quantity += 1;
        existing.totalAmount += rev.newOrderTotal?.toNumber() || 0;
        stateAgg.set(state, existing);
      }
    });

    // Aggregate by Manufacturer (use newManufacturer if available, else originalManufacturer)
    const manufacturerAgg = new Map<string, { manufacturer: string; quantity: number; totalAmount: number }>();
    revisions.forEach((rev) => {
      const manufacturer = rev.newManufacturer || rev.originalManufacturer;
      if (manufacturer) {
        const existing = manufacturerAgg.get(manufacturer) || { manufacturer, quantity: 0, totalAmount: 0 };
        existing.quantity += 1;
        existing.totalAmount += rev.newOrderTotal?.toNumber() || 0;
        manufacturerAgg.set(manufacturer, existing);
      }
    });

    // Convert to sorted arrays
    const salesRepData = Array.from(salesRepAgg.values()).sort((a, b) => b.totalAmount - a.totalAmount);
    const stateData = Array.from(stateAgg.values()).sort((a, b) => b.totalAmount - a.totalAmount);
    const manufacturerData = Array.from(manufacturerAgg.values()).sort((a, b) => b.totalAmount - a.totalAmount);

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
