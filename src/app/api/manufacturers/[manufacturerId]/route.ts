import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

const updateManufacturerSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ manufacturerId: string }> }
) {
  try {
    await requirePermission("settings.edit");
    const { manufacturerId } = await params;
    const body = await request.json();

    const validation = updateManufacturerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const existing = await prisma.manufacturer.findUnique({
      where: { id: manufacturerId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Manufacturer not found" },
        { status: 404 }
      );
    }

    const { name, isActive } = validation.data;

    // Check name uniqueness if changing
    if (name && name !== existing.name) {
      const nameExists = await prisma.manufacturer.findUnique({
        where: { name },
      });
      if (nameExists) {
        return NextResponse.json(
          { success: false, error: "Manufacturer name already exists" },
          { status: 400 }
        );
      }
    }

    const manufacturer = await prisma.manufacturer.update({
      where: { id: manufacturerId },
      data: {
        ...(name !== undefined && { name }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ success: true, data: manufacturer });
  } catch (error) {
    console.error("PATCH /api/manufacturers/[manufacturerId] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update manufacturer" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ manufacturerId: string }> }
) {
  try {
    await requirePermission("settings.edit");
    const { manufacturerId } = await params;

    const manufacturer = await prisma.manufacturer.findUnique({
      where: { id: manufacturerId },
    });

    if (!manufacturer) {
      return NextResponse.json(
        { success: false, error: "Manufacturer not found" },
        { status: 404 }
      );
    }

    await prisma.manufacturer.delete({
      where: { id: manufacturerId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/manufacturers/[manufacturerId] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete manufacturer" },
      { status: 500 }
    );
  }
}
