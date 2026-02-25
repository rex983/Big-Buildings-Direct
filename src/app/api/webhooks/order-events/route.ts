import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const WEBHOOK_SECRET = process.env.ORDER_WEBHOOK_SECRET;

function verifyAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !WEBHOOK_SECRET) return false;
  const token = authHeader.replace("Bearer ", "");
  return token === WEBHOOK_SECRET;
}

/**
 * Webhook endpoint that receives events from the Order Process app.
 * Since BBD now reads directly from the Order Process `orders` table,
 * this webhook's primary role is to:
 * 1. Insert events into `order_processing_events` for Realtime subscriptions
 * 2. Signal BBD clients to refresh their data
 */
export async function POST(request: NextRequest) {
  try {
    if (!verifyAuth(request)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { orderId, eventType, payload } = body as {
      orderId: string;
      eventType: string;
      payload: Record<string, unknown>;
    };

    if (!orderId || !eventType) {
      return NextResponse.json(
        { success: false, error: "Missing orderId or eventType" },
        { status: 400 }
      );
    }

    // Insert event into Supabase so Realtime subscriptions pick it up.
    // BBD clients listen on `order_processing_events` to know when to refresh.
    const { error: supabaseError } = await supabaseAdmin
      .from("order_processing_events")
      .insert({
        order_id: orderId,
        event_type: eventType,
        status: "completed",
        payload,
        source: "order_processor",
        processed_at: new Date().toISOString(),
      });

    if (supabaseError) {
      console.error("Failed to insert event into Supabase:", supabaseError);
      return NextResponse.json(
        { success: false, error: "Failed to record event" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/webhooks/order-events error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
