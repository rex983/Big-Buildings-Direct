import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { getEventsByOrder } from "@/lib/order-events";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    await requirePermission(["orders.view"]);
    const { orderId } = await params;

    const events = await getEventsByOrder(orderId);

    const eventTypes = new Set(events.map((e) => e.event_type));

    const lastEvent = events[0] || null;

    return NextResponse.json({
      success: true,
      data: {
        esignRequested: eventTypes.has("esign_requested"),
        esignSent: eventTypes.has("esign_sent"),
        customerSigned: eventTypes.has("customer_signed"),
        depositCollected: eventTypes.has("deposit_collected"),
        hasError: events.some(
          (e) => e.event_type === "error" && e === events.find((ev) => ev.event_type === "error")
        ),
        lastEvent: lastEvent
          ? {
              type: lastEvent.event_type,
              status: lastEvent.status,
              createdAt: lastEvent.created_at,
              payload: lastEvent.payload,
            }
          : null,
        events: events.map((e) => ({
          id: e.id,
          type: e.event_type,
          status: e.status,
          source: e.source,
          createdAt: e.created_at,
          processedAt: e.processed_at,
        })),
      },
    });
  } catch (error) {
    console.error("GET /api/orders/[orderId]/esign/status error:", error);

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
      { success: false, error: "Failed to get e-sign status" },
      { status: 500 }
    );
  }
}
