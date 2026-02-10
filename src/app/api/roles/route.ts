import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

const createRoleSchema = z.object({
  name: z.string().min(1, "Role name is required"),
  description: z.string().optional(),
  permissionIds: z.array(z.string()).optional(),
});

export async function GET() {
  try {
    await requirePermission("roles.view");

    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ success: true, data: roles });
  } catch (error) {
    console.error("GET /api/roles error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch roles" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission("roles.create");
    const body = await request.json();

    const validation = createRoleSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, description, permissionIds } = validation.data;

    // Check if name already exists
    const existingRole = await prisma.role.findUnique({
      where: { name },
    });

    if (existingRole) {
      return NextResponse.json(
        { success: false, error: "Role name already exists" },
        { status: 400 }
      );
    }

    const role = await prisma.role.create({
      data: {
        name,
        description,
        permissions: permissionIds?.length
          ? {
              createMany: {
                data: permissionIds.map((permissionId) => ({ permissionId })),
              },
            }
          : undefined,
      },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: role }, { status: 201 });
  } catch (error) {
    console.error("POST /api/roles error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create role" },
      { status: 500 }
    );
  }
}
