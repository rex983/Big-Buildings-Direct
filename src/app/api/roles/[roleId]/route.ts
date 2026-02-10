import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  try {
    await requirePermission("roles.view");
    const { roleId } = await params;

    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: {
          include: { permission: true },
        },
        _count: {
          select: { users: true },
        },
      },
    });

    if (!role) {
      return NextResponse.json(
        { success: false, error: "Role not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: role });
  } catch (error) {
    console.error("GET /api/roles/[roleId] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch role" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  try {
    await requirePermission("roles.edit");
    const { roleId } = await params;
    const body = await request.json();

    const validation = updateRoleSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const existingRole = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!existingRole) {
      return NextResponse.json(
        { success: false, error: "Role not found" },
        { status: 404 }
      );
    }

    if (existingRole.isSystem) {
      return NextResponse.json(
        { success: false, error: "Cannot modify system roles" },
        { status: 400 }
      );
    }

    const { name, description } = validation.data;

    // Check name uniqueness if changing
    if (name && name !== existingRole.name) {
      const nameExists = await prisma.role.findUnique({
        where: { name },
      });
      if (nameExists) {
        return NextResponse.json(
          { success: false, error: "Role name already exists" },
          { status: 400 }
        );
      }
    }

    const role = await prisma.role.update({
      where: { id: roleId },
      data: { name, description },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: role });
  } catch (error) {
    console.error("PATCH /api/roles/[roleId] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update role" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  try {
    await requirePermission("roles.delete");
    const { roleId } = await params;

    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        _count: { select: { users: true } },
      },
    });

    if (!role) {
      return NextResponse.json(
        { success: false, error: "Role not found" },
        { status: 404 }
      );
    }

    if (role.isSystem) {
      return NextResponse.json(
        { success: false, error: "Cannot delete system roles" },
        { status: 400 }
      );
    }

    if (role._count.users > 0) {
      return NextResponse.json(
        { success: false, error: "Cannot delete role with assigned users" },
        { status: 400 }
      );
    }

    await prisma.role.delete({
      where: { id: roleId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/roles/[roleId] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete role" },
      { status: 500 }
    );
  }
}
