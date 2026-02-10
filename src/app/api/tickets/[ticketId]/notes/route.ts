import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, isAdmin } from "@/lib/auth";

const createNoteSchema = z.object({
  content: z.string().min(1, "Note content is required"),
  isInternal: z.boolean().default(false),
});

// POST /api/tickets/[ticketId]/notes - Add note to ticket
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const user = await requirePermission(["orders.view"]);
    const { ticketId } = await params;

    // Only Admin, Manager, BST can add notes
    const canAddNote =
      isAdmin(user.roleName) ||
      user.roleName === "Manager" ||
      user.roleName === "BST";

    if (!canAddNote) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to add notes" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createNoteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    // Verify ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, ticketNumber: true },
    });

    if (!ticket) {
      return NextResponse.json(
        { success: false, error: "Ticket not found" },
        { status: 404 }
      );
    }

    const { content, isInternal } = validation.data;

    // Create note and activity in transaction
    const note = await prisma.$transaction(async (tx) => {
      const newNote = await tx.ticketNote.create({
        data: {
          ticketId,
          authorId: user.id,
          content,
          isInternal,
        },
        include: {
          author: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      // Create activity log
      await tx.ticketActivity.create({
        data: {
          ticketId,
          userId: user.id,
          action: "NOTE_ADDED",
          description: `${isInternal ? "Internal note" : "Note"} added`,
          metadata: JSON.stringify({
            noteId: newNote.id,
            isInternal,
            contentPreview: content.substring(0, 100),
          }),
        },
      });

      return newNote;
    });

    return NextResponse.json({
      success: true,
      data: note,
    });
  } catch (error) {
    console.error("POST /api/tickets/[ticketId]/notes error:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to add note" },
      { status: 500 }
    );
  }
}
