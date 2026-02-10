import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { BaseSessionUser } from "@/types";

// POST - Start impersonation
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if the actual user is an admin
    // If already impersonating, check originalUser instead
    const actualUser = session.user.originalUser || session.user;
    if (actualUser.roleName !== "Admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    // Prevent nested impersonation
    if (session.user.impersonatingAs) {
      return NextResponse.json(
        { success: false, error: "Cannot nest impersonation. Exit current view first." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    // Cannot impersonate yourself
    if (userId === actualUser.id) {
      return NextResponse.json(
        { success: false, error: "Cannot impersonate yourself" },
        { status: 400 }
      );
    }

    // Fetch target user with role and permissions
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!targetUser || !targetUser.isActive) {
      return NextResponse.json(
        { success: false, error: "User not found or inactive" },
        { status: 404 }
      );
    }

    // Build the user object to impersonate
    const impersonatingAs: BaseSessionUser = {
      id: targetUser.id,
      email: targetUser.email,
      firstName: targetUser.firstName,
      lastName: targetUser.lastName,
      roleId: targetUser.roleId,
      roleName: targetUser.role.name,
      permissions: targetUser.role.permissions.map((rp) => rp.permission.name),
    };

    return NextResponse.json({
      success: true,
      data: { impersonatingAs },
    });
  } catch (error) {
    console.error("Impersonation error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Stop impersonation
export async function DELETE() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!session.user.originalUser) {
      return NextResponse.json(
        { success: false, error: "Not currently impersonating" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { stopImpersonation: true },
    });
  } catch (error) {
    console.error("Stop impersonation error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
