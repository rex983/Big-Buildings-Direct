import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { getStorage } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    await requirePermission("files.view");
    const { fileId } = await params;

    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return NextResponse.json(
        { success: false, error: "File not found" },
        { status: 404 }
      );
    }

    const storage = getStorage();
    const buffer = await storage.download(file.storagePath);

    const searchParams = request.nextUrl.searchParams;
    const download = searchParams.get("download") === "true";
    const filename = searchParams.get("filename") || file.filename;

    const headers = new Headers();
    headers.set("Content-Type", file.mimeType);
    headers.set("Content-Length", buffer.length.toString());

    if (download) {
      headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    } else {
      headers.set("Content-Disposition", `inline; filename="${filename}"`);
    }

    return new NextResponse(new Uint8Array(buffer), { headers });
  } catch (error) {
    console.error("GET /api/files/[fileId] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to download file" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const user = await requirePermission("files.delete");
    const { fileId } = await params;

    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: {
        orderFiles: true,
        ticketFiles: true,
      },
    });

    if (!file) {
      return NextResponse.json(
        { success: false, error: "File not found" },
        { status: 404 }
      );
    }

    // Delete from storage
    const storage = getStorage();
    await storage.delete(file.storagePath);

    // Batch-create activity logs for linked orders and tickets
    const orderActivities = file.orderFiles.map((of) => ({
      orderId: of.orderId,
      type: "FILE_DELETED",
      description: `File "${file.filename}" was deleted`,
      userId: user.id,
    }));

    const ticketActivities = file.ticketFiles.map((tf) => ({
      ticketId: tf.ticketId,
      action: "FILE_REMOVED",
      description: `File "${file.filename}" was removed`,
      userId: user.id,
    }));

    await Promise.all([
      orderActivities.length > 0
        ? prisma.orderActivity.createMany({ data: orderActivities })
        : Promise.resolve(),
      ticketActivities.length > 0
        ? prisma.ticketActivity.createMany({ data: ticketActivities })
        : Promise.resolve(),
    ]);

    // Delete file record (cascade will handle orderFiles, ticketFiles)
    await prisma.file.delete({
      where: { id: fileId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/files/[fileId] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete file" },
      { status: 500 }
    );
  }
}
