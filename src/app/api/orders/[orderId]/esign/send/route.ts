import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { publishEvent } from "@/lib/order-events";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const user = await requirePermission(["orders.edit", "documents.send"]);
    const { orderId } = await params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        files: {
          include: { file: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    if (order.sentToCustomer) {
      return NextResponse.json(
        { success: false, error: "Order has already been sent for processing" },
        { status: 400 }
      );
    }

    // Find first PDF attachment
    const pdfFile = order.files.find(
      (of) => of.file.mimeType === "application/pdf"
    );

    if (!pdfFile) {
      return NextResponse.json(
        { success: false, error: "No PDF file attached to this order" },
        { status: 400 }
      );
    }

    // Split customer name into first/last
    const nameParts = order.customerName.trim().split(/\s+/);
    const customerFirstName = nameParts[0] || "";
    const customerLastName = nameParts.slice(1).join(" ") || "";

    // Publish event for the Python order processor to pick up
    const event = await publishEvent(orderId, "esign_requested", {
      bbdOrderId: order.id,
      orderNumber: order.orderNumber,
      customerFirstName,
      customerLastName,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone || "",
      deliveryAddress: order.deliveryAddress,
      deliveryCity: order.deliveryCity,
      deliveryState: order.deliveryState,
      deliveryZip: order.deliveryZip,
      buildingType: order.buildingType,
      buildingWidth: order.buildingWidth || "",
      buildingLength: order.buildingLength || "",
      buildingHeight: order.buildingHeight || "",
      totalPrice: Number(order.totalPrice),
      depositAmount: Number(order.depositAmount),
      installer: order.installer || "",
      pdfFileId: pdfFile.file.id,
      pdfStoragePath: pdfFile.file.storagePath,
      pdfFileName: pdfFile.file.filename,
    });

    // Update order status and create activity
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          sentToCustomer: true,
          sentToCustomerDate: new Date(),
        },
      });

      await tx.orderActivity.create({
        data: {
          orderId,
          type: "ESIGN_SENT",
          description: "Order sent for processing (e-sign, signature, deposit)",
          userId: user.id,
          metadata: JSON.stringify({
            eventId: event.id,
            pdfFileName: pdfFile.file.filename,
            timestamp: new Date().toISOString(),
          }),
        },
      });
    });

    return NextResponse.json({
      success: true,
      data: { eventId: event.id },
    });
  } catch (error) {
    console.error("POST /api/orders/[orderId]/esign/send error:", error);

    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to send for processing" },
      { status: 500 }
    );
  }
}
