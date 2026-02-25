import { supabaseAdmin } from "@/lib/supabase";

export type OrderEventType =
  | "esign_requested"
  | "esign_sent"
  | "customer_signed"
  | "deposit_collected"
  | "order_status_update"
  | "error";

export type OrderEventSource = "bbd" | "order_processor";

export interface OrderProcessingEvent {
  id: string;
  order_id: string;
  event_type: OrderEventType;
  status: "pending" | "processing" | "completed" | "failed";
  payload: Record<string, unknown>;
  source: OrderEventSource;
  created_at: string;
  processed_at: string | null;
}

/**
 * Publish an event to the order_processing_events table.
 * Used by BBD to signal the Python order processor.
 */
export async function publishEvent(
  orderId: string,
  eventType: OrderEventType,
  payload: Record<string, unknown> = {}
): Promise<OrderProcessingEvent> {
  const { data, error } = await supabaseAdmin
    .from("order_processing_events")
    .insert({
      order_id: orderId,
      event_type: eventType,
      status: "pending",
      payload,
      source: "bbd" as OrderEventSource,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to publish order event:", error);
    throw new Error(`Failed to publish event: ${error.message}`);
  }

  return data as OrderProcessingEvent;
}

/**
 * Get the latest event for an order, optionally filtered by event type.
 */
export async function getLatestEvent(
  orderId: string,
  eventType?: OrderEventType
): Promise<OrderProcessingEvent | null> {
  let query = supabaseAdmin
    .from("order_processing_events")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (eventType) {
    query = query.eq("event_type", eventType);
  }

  const { data, error } = await query.single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows returned
    console.error("Failed to get latest event:", error);
    throw new Error(`Failed to get latest event: ${error.message}`);
  }

  return (data as OrderProcessingEvent) || null;
}

/**
 * Get all events for an order, sorted by created_at descending.
 */
export async function getEventsByOrder(
  orderId: string
): Promise<OrderProcessingEvent[]> {
  const { data, error } = await supabaseAdmin
    .from("order_processing_events")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to get events by order:", error);
    throw new Error(`Failed to get events: ${error.message}`);
  }

  return (data as OrderProcessingEvent[]) || [];
}
