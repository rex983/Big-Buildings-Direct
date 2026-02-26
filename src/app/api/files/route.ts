import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { getStorage, generateStorageKey } from "@/lib/storage";

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("files.upload");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const orderId = formData.get("orderId") as string | null;
    const ticketId = formData.get("ticketId") as string | null;
    const category = (formData.get("category") as string) || "OTHER";
    const description = formData.get("description") as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "File size must be less than 10MB" },
        { status: 400 }
      );
    }

    // Generate storage key
    const storageKey = generateStorageKey(file.name);

    // Read file data
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to storage
    const storage = getStorage();
    await storage.upload(storageKey, buffer, {
      mimeType: file.type,
      filename: file.name,
    });

    // Create file record
    const fileRecord = await prisma.file.create({
      data: {
        filename: file.name,
        storagePath: storageKey,
        mimeType: file.type,
        size: file.size,
        category: category as "CONTRACT" | "INVOICE" | "BLUEPRINT" | "PHOTO" | "PERMIT" | "OTHER",
        description: description || undefined,
        uploadedById: user.id,
      },
    });

    // Link to order if provided
    if (orderId) {
      await prisma.orderFile.create({
        data: {
          orderId,
          fileId: fileRecord.id,
        },
      });

      // Log activity
      await prisma.orderActivity.create({
        data: {
          orderId,
          type: "FILE_UPLOADED",
          description: `File "${file.name}" was uploaded`,
          userId: user.id,
        },
      });
    }

    // Link to ticket if provided
    if (ticketId) {
      await prisma.ticketFile.create({
        data: {
          ticketId,
          fileId: fileRecord.id,
        },
      });

      // Log ticket activity
      await prisma.ticketActivity.create({
        data: {
          ticketId,
          action: "FILE_ATTACHED",
          description: `File "${file.name}" was attached`,
          userId: user.id,
        },
      });
    }

    return NextResponse.json({ success: true, data: fileRecord }, { status: 201 });
  } catch (error) {
    console.error("POST /api/files error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
