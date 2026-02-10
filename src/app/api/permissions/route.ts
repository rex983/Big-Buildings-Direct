import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

export async function GET() {
  try {
    await requirePermission("roles.view");

    const permissions = await prisma.permission.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    // Group by category
    const grouped = permissions.reduce(
      (acc, permission) => {
        if (!acc[permission.category]) {
          acc[permission.category] = [];
        }
        acc[permission.category].push(permission);
        return acc;
      },
      {} as Record<string, typeof permissions>
    );

    return NextResponse.json({
      success: true,
      data: {
        permissions,
        grouped,
      },
    });
  } catch (error) {
    console.error("GET /api/permissions error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch permissions" },
      { status: 500 }
    );
  }
}
