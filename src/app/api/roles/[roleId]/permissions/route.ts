import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

const updatePermissionsSchema = z.object({
  permissionIds: z.array(z.string()),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  try {
    await requirePermission("roles.edit");
    const { roleId } = await params;
    const body = await request.json();

    const validation = updatePermissionsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Invalid permission IDs" },
        { status: 400 }
      );
    }

    const { permissionIds } = validation.data;

    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      return NextResponse.json(
        { success: false, error: "Role not found" },
        { status: 404 }
      );
    }

    if (role.isSystem && role.name === "Admin") {
      return NextResponse.json(
        { success: false, error: "Cannot modify Admin role permissions" },
        { status: 400 }
      );
    }

    // Verify all permissions exist
    const permissions = await prisma.permission.findMany({
      where: { id: { in: permissionIds } },
    });

    if (permissions.length !== permissionIds.length) {
      return NextResponse.json(
        { success: false, error: "One or more permissions not found" },
        { status: 400 }
      );
    }

    // Replace all permissions
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({
        where: { roleId },
      }),
      prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId,
          permissionId,
        })),
      }),
    ]);

    const updatedRole = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: updatedRole });
  } catch (error) {
    console.error("PUT /api/roles/[roleId]/permissions error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update permissions" },
      { status: 500 }
    );
  }
}
