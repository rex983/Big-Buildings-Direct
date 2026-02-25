"use client";

import { useEffect, useState, useCallback } from "react";
import { supabaseClient } from "@/lib/supabase-client";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";

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
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [latestEvent, setLatestEvent] = useState<OrderEvent | null>(null);

  const handleInsert = useCallback(
    (payload: RealtimePostgresInsertPayload<OrderEvent>) => {
      const newEvent = payload.new;
      setEvents((prev) => [newEvent, ...prev]);
      setLatestEvent(newEvent);
    },
    []
  );

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
          // Only process events from the Python order processor
          if (newEvent.source === "order_processor") {
            handleInsert(
              payload as RealtimePostgresInsertPayload<OrderEvent>
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [orderId, handleInsert]);

  return { events, latestEvent };
}
