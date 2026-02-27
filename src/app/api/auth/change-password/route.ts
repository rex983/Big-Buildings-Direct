import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { validatePasswordComplexity } from "@/lib/password-validation";

const MAX_PASSWORD_HISTORY = 3;

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(1, "New password is required"),
});

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireAuth();
    const body = await request.json();

    const validation = changePasswordSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = validation.data;

    // Validate complexity
    const complexityResult = validatePasswordComplexity(newPassword);
    if (!complexityResult.valid) {
      return NextResponse.json(
        {
          success: false,
          error: "Password does not meet requirements",
          details: complexityResult.errors,
        },
        { status: 400 }
      );
    }

    // Fetch user with current password
    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { id: true, password: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Verify current password
    const isCurrentValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentValid) {
      return NextResponse.json(
        { success: false, error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    // Check against current password
    const matchesCurrent = await bcrypt.compare(newPassword, user.password);
    if (matchesCurrent) {
      return NextResponse.json(
        { success: false, error: "New password cannot be the same as your current password" },
        { status: 400 }
      );
    }

    // Check against password history
    const history = await prisma.passwordHistory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: MAX_PASSWORD_HISTORY,
      select: { password: true },
    });

    for (const entry of history) {
      const matchesHistory = await bcrypt.compare(newPassword, entry.password);
      if (matchesHistory) {
        return NextResponse.json(
          {
            success: false,
            error: "Cannot reuse any of your last 3 passwords",
          },
          { status: 400 }
        );
      }
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Archive current and update in a transaction
    await prisma.$transaction(async (tx) => {
      // Archive current password
      await tx.passwordHistory.create({
        data: {
          userId: user.id,
          password: user.password,
        },
      });

      // Prune old history
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

      // Update password and clear flag
      await tx.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          mustChangePassword: false,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/auth/change-password error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to change password" },
      { status: 500 }
    );
  }
}
