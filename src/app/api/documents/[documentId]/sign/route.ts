import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getStorage, generateStorageKey } from "@/lib/storage";
import { embedSignatureInPdf, isValidSignatureData } from "@/lib/signing";

const signDocumentSchema = z.object({
  signatureData: z.string().min(1, "Signature is required"),
  signingToken: z.string().min(1, "Signing token is required"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const body = await request.json();

    const validation = signDocumentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { signatureData, signingToken } = validation.data;

    // Validate signature data format
    if (!isValidSignatureData(signatureData)) {
      return NextResponse.json(
        { success: false, error: "Invalid signature data" },
        { status: 400 }
      );
    }

    // Find document by token
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        signingToken,
      },
      include: {
        file: true,
        order: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: "Invalid signing token" },
        { status: 404 }
      );
    }

    if (document.status === "SIGNED") {
      return NextResponse.json(
        { success: false, error: "Document has already been signed" },
        { status: 400 }
      );
    }

    if (document.status !== "SENT" && document.status !== "VIEWED") {
      return NextResponse.json(
        { success: false, error: "Document is not ready for signing" },
        { status: 400 }
      );
    }

    // Get the original PDF
    const storage = getStorage();
    const pdfBuffer = await storage.download(document.file.storagePath);

    // Embed signature in PDF
    const signedPdfBuffer = await embedSignatureInPdf(pdfBuffer, signatureData, {
      addTimestamp: true,
      timestampText: `Signed electronically on ${new Date().toISOString()}`,
    });

    // Upload signed PDF
    const signedStorageKey = generateStorageKey(`signed-${document.file.filename}`);
    await storage.upload(signedStorageKey, signedPdfBuffer, {
      mimeType: "application/pdf",
      filename: `signed-${document.file.filename}`,
    });

    // Create new file record for signed document
    const signedFile = await prisma.file.create({
      data: {
        filename: `signed-${document.file.filename}`,
        storagePath: signedStorageKey,
        mimeType: "application/pdf",
        size: signedPdfBuffer.length,
        category: "CONTRACT",
        description: `Signed version of ${document.title}`,
        uploadedById: document.createdById,
      },
    });

    // Link signed file to order
    await prisma.orderFile.create({
      data: {
        orderId: document.orderId,
        fileId: signedFile.id,
      },
    });

    // Get client info for audit trail
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const signerIp = forwardedFor?.split(",")[0] || realIp || "unknown";
    const signerAgent = request.headers.get("user-agent") || "unknown";

    // Update document
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: "SIGNED",
        signedAt: new Date(),
        signatureData,
        signerIp,
        signerAgent,
        signedById: document.order.customerId,
      },
    });

    // Log activity
    await prisma.orderActivity.create({
      data: {
        orderId: document.orderId,
        type: "DOCUMENT_SIGNED",
        description: `Document "${document.title}" was signed`,
        userId: document.order.customerId,
        metadata: JSON.stringify({ signerIp, documentId }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        message: "Document signed successfully",
      },
    });
  } catch (error) {
    console.error("POST /api/documents/[documentId]/sign error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to sign document" },
      { status: 500 }
    );
  }
}
