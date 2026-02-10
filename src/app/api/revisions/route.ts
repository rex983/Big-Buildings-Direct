import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("orders.edit");

    const body = await request.json();
    const {
      orderId,
      revisionDate,
      changeDescription,
      changeInPrice,
      newTotalPrice,
      changingManufacturer,
      newManufacturer,
      revisionFee,
      paymentMethod,
    } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Order ID is required" },
        { status: 400 }
      );
    }

    // Verify order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true, totalPrice: true },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    // Count existing revisions for this order to auto-generate revision number
    const existingCount = await prisma.revision.count({
      where: { orderId },
    });
    const revisionNumber = `Revision${existingCount + 1}`;

    // Calculate diffs if new total provided
    const oldOrderTotal = order.totalPrice ? Number(order.totalPrice) : null;
    const newTotal = newTotalPrice ? parseFloat(newTotalPrice) : null;
    const orderTotalDiff = oldOrderTotal != null && newTotal != null ? newTotal - oldOrderTotal : null;

    const revision = await prisma.revision.create({
      data: {
        orderId,
        revisionNumber,
        revisionDate: revisionDate ? new Date(revisionDate) : new Date(),
        changeInPrice: changeInPrice || null,
        oldOrderTotal: oldOrderTotal,
        newOrderTotal: newTotal,
        orderTotalDiff: orderTotalDiff,
        revisionNotes: changeDescription || null,
        changingManufacturer: changingManufacturer === true,
        newManufacturer: changingManufacturer ? (newManufacturer || null) : null,
        revisionFee: revisionFee ? parseFloat(String(revisionFee)) : null,
        paymentMethod: revisionFee ? (paymentMethod || null) : null,
        salesRepId: null,
      },
      include: {
        order: {
          select: { id: true, orderNumber: true },
        },
      },
    });

    // Log order activity
    await prisma.orderActivity.create({
      data: {
        orderId,
        type: "REVISION_CREATED",
        description: `${revisionNumber} created${changeDescription ? `: ${changeDescription}` : ""}`,
        userId: user.id,
      },
    });

    return NextResponse.json({ success: true, data: revision }, { status: 201 });
  } catch (error) {
    console.error("POST /api/revisions error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create revision" },
      { status: 500 }
    );
  }
}
