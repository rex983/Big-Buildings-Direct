import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isAdmin } from "@/lib/auth";
import { getOrderLocations, getOfficeSalesPersons } from "@/lib/order-process";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const user = await requirePermission("orders.view");

    const isAdminUser = isAdmin(user.roleName);
    const isManager = user.roleName === "Manager";
    const canViewAll = user.permissions.includes("orders.view_all");

    let salesPerson: string | undefined;
    let salesPersons: string[] | undefined;

    if (isAdminUser) {
      // Admin sees everything
    } else if (isManager && user.office) {
      salesPersons = await getOfficeSalesPersons(user.office);
    } else if (canViewAll) {
      // BST, R&D see everything
    } else {
      salesPerson = `${user.firstName} ${user.lastName}`;
    }

    const locations = await getOrderLocations({ salesPerson, salesPersons });

    return NextResponse.json({ success: true, data: locations });
  } catch (error) {
    console.error("GET /api/orders/locations error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch order locations" },
      { status: 500 }
    );
  }
}

/** Save geocoded coordinates back to the orders table (batch). */
export async function POST(request: NextRequest) {
  try {
    await requirePermission("orders.view");

    const { coords } = await request.json();
    if (!Array.isArray(coords) || coords.length === 0) {
      return NextResponse.json({ success: true, saved: 0 });
    }

    let saved = 0;
    // Batch update in chunks of 50
    for (let i = 0; i < coords.length; i += 50) {
      const batch = coords.slice(i, i + 50);
      const promises = batch.map(
        (c: { id: string; lat: number; lng: number }) =>
          supabaseAdmin
            .from("orders")
            .update({ latitude: c.lat, longitude: c.lng })
            .eq("id", c.id)
      );
      const results = await Promise.all(promises);
      saved += results.filter((r) => !r.error).length;
    }

    return NextResponse.json({ success: true, saved });
  } catch (error) {
    console.error("POST /api/orders/locations error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save geocode data" },
      { status: 500 }
    );
  }
}
