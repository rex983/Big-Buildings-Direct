import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAdmin } from "@/lib/auth";
import { generateTempPassword } from "@/lib/password-validation";

const MAX_PASSWORD_HISTORY = 3;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const currentUser = await requireAuth();

    if (!isAdmin(currentUser.roleName)) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    const { userId } = await params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Generate temp password
    const tempPassword = generateTempPassword(16);
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    // Archive current password and update user in a transaction
    await prisma.$transaction(async (tx) => {
      // Archive current password hash
      await tx.passwordHistory.create({
        data: {
          userId: user.id,
          password: user.password,
        },
      });

      // Prune old history entries (keep only MAX_PASSWORD_HISTORY)
      const historyEntries = await tx.passwordHistory.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

      if (historyEntries.length > MAX_PASSWORD_HISTORY) {
        const idsToDelete = historyEntries
          .slice(MAX_PASSWORD_HISTORY)
          .map((e) => e.id);
        await tx.passwordHistory.deleteMany({
          where: { id: { in: idsToDelete } },
        });
      }

      // Update user with new password and force change flag
      await tx.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          mustChangePassword: true,
        },
      });
    });

    return NextResponse.json({
      success: true,
      data: { tempPassword },
    });
  } catch (error) {
    console.error("POST /api/users/[userId]/reset-password error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to reset password" },
      { status: 500 }
    );
  }
}
