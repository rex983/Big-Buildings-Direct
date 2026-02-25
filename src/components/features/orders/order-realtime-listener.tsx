"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useOrderEvents } from "@/hooks/use-order-events";
import { useToast } from "@/components/ui/toast";

const EVENT_LABELS: Record<string, { title: string; description: string }> = {
  esign_sent: {
    title: "E-Sign Sent",
    description: "Document has been sent for e-signing",
  },
  customer_signed: {
    title: "Customer Signed",
    description: "Customer has signed the document",
  },
  deposit_collected: {
    title: "Deposit Collected",
    description: "Deposit payment has been collected",
  },
  order_status_update: {
    title: "Order Updated",
    description: "Order status has been updated",
  },
  error: {
    title: "Processing Error",
    description: "An error occurred during order processing",
  },
};

// Events that should trigger a page data refresh
const REFRESH_EVENTS = new Set([
  "esign_sent",
  "customer_signed",
  "deposit_collected",
  "order_status_update",
]);

interface OrderRealtimeListenerProps {
  orderId: string;
}

export function OrderRealtimeListener({
  orderId,
}: OrderRealtimeListenerProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const { latestEvent } = useOrderEvents(orderId);
  const processedEventIds = useRef(new Set<string>());

  useEffect(() => {
    if (!latestEvent) return;
    if (processedEventIds.current.has(latestEvent.id)) return;

    processedEventIds.current.add(latestEvent.id);

    const label = EVENT_LABELS[latestEvent.event_type];
    if (label) {
      const errorMessage =
        latestEvent.event_type === "error"
          ? (latestEvent.payload?.message as string) || label.description
          : label.description;

      addToast({
        title: label.title,
        description: errorMessage,
        variant: latestEvent.event_type === "error" ? "destructive" : "success",
      });
    }

    if (REFRESH_EVENTS.has(latestEvent.event_type)) {
      router.refresh();
    }
  }, [latestEvent, addToast, router]);

  return null;
}
