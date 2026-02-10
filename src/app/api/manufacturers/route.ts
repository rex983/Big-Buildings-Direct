import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

const createManufacturerSchema = z.object({
  name: z.string().min(1, "Manufacturer name is required"),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";

    const manufacturers = await prisma.manufacturer.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ success: true, data: manufacturers });
  } catch (error) {
    console.error("GET /api/manufacturers error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch manufacturers" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission("settings.edit");
    const body = await request.json();

    const validation = createManufacturerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name } = validation.data;

    const existing = await prisma.manufacturer.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: "Manufacturer name already exists" },
        { status: 400 }
      );
    }

    const manufacturer = await prisma.manufacturer.create({
      data: { name },
    });

    return NextResponse.json({ success: true, data: manufacturer }, { status: 201 });
  } catch (error) {
    console.error("POST /api/manufacturers error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create manufacturer" },
      { status: 500 }
    );
  }
}
