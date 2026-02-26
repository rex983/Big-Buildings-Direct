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
    const { userId, customerEmail, customerName } = body;

    if (!userId && !customerEmail) {
      return NextResponse.json(
        { success: false, error: "User ID or customer email is required" },
        { status: 400 }
      );
    }

    let impersonatingAs: BaseSessionUser;

    if (customerEmail) {
      // Supabase-derived customer impersonation (no Prisma user needed)
      const email = (customerEmail as string).toLowerCase().trim();
      if (email === actualUser.email) {
        return NextResponse.json(
          { success: false, error: "Cannot impersonate yourself" },
          { status: 400 }
        );
      }

      // Get the Customer role ID from Prisma (for session compatibility)
      const customerRole = await prisma.role.findUnique({
        where: { name: "Customer" },
        select: { id: true },
      });

      const nameParts = ((customerName as string) || "Customer").split(" ");

      impersonatingAs = {
        id: `customer_${email}`,
        email,
        firstName: nameParts[0] || "Customer",
        lastName: nameParts.slice(1).join(" ") || "",
        roleId: customerRole?.id || "customer",
        roleName: "Customer",
        permissions: [],
      };
    } else {
      // Standard Prisma user impersonation
      if (userId === actualUser.id) {
        return NextResponse.json(
          { success: false, error: "Cannot impersonate yourself" },
          { status: 400 }
        );
      }

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

      impersonatingAs = {
        id: targetUser.id,
        email: targetUser.email,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        roleId: targetUser.roleId,
        roleName: targetUser.role.name,
        permissions: targetUser.role.permissions.map((rp) => rp.permission.name),
        office: targetUser.office || undefined,
      };
    }

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
