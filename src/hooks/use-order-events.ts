"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabase-client";

export interface OrderEvent {
  id: string;
  order_id: string;
  event_type: string;
  status: string;
  payload: Record<string, unknown>;
  source: string;
  created_at: string;
  processed_at: string | null;
}

export function useOrderEvents(orderId: string) {
  const [latestEvent, setLatestEvent] = useState<OrderEvent | null>(null);

  useEffect(() => {
    const channel = supabaseClient
      .channel(`order-events-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_processing_events",
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          const newEvent = payload.new as OrderEvent;
          if (newEvent.source === "order_processor") {
            setLatestEvent(newEvent);
          }
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [orderId]);

  return { latestEvent };
}
