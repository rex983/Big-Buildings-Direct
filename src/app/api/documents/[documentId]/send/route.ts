import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { generateSigningToken, getSigningUrl } from "@/lib/signing";
import { sendEmail, getSigningRequestEmail } from "@/lib/email";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const user = await requirePermission("documents.send");
    const { documentId } = await params;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        order: true,
        file: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: "Document not found" },
        { status: 404 }
      );
    }

    if (document.status !== "DRAFT") {
      return NextResponse.json(
        { success: false, error: "Document has already been sent" },
        { status: 400 }
      );
    }

    // Generate signing token
    const signingToken = generateSigningToken();
    const signingUrl = getSigningUrl(signingToken);

    // Update document
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: "SENT",
        sentAt: new Date(),
        signingToken,
      },
    });

    // Send email to customer
    const emailContent = getSigningRequestEmail({
      customerName: document.order.customerName,
      documentTitle: document.title,
      signingUrl,
    });

    const emailResult = await sendEmail({
      to: document.order.customerEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    // Log email in database
    await prisma.email.create({
      data: {
        subject: emailContent.subject,
        body: emailContent.html,
        toAddress: document.order.customerEmail,
        fromAddress: process.env.EMAIL_FROM || "noreply@bigbuildingsdirect.com",
        status: emailResult.success ? "SENT" : "FAILED",
        sentAt: emailResult.success ? new Date() : undefined,
        failReason: emailResult.error,
        externalId: emailResult.messageId,
        orderId: document.orderId,
        sentById: user.id,
      },
    });

    // Log activity
    await prisma.orderActivity.create({
      data: {
        orderId: document.orderId,
        type: "DOCUMENT_SENT",
        description: `Document "${document.title}" sent for signing`,
        userId: user.id,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        signingUrl,
        emailSent: emailResult.success,
      },
    });
  } catch (error) {
    console.error("POST /api/documents/[documentId]/send error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send document" },
      { status: 500 }
    );
  }
}
