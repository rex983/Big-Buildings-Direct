"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabase-client";

/**
 * Keeps BBD pages in sync with Order Process data using two mechanisms:
 *
 * 1. Supabase Realtime — listens to the `order_processing_events` bridge
 *    table for instant updates when Order Process fires events (e-sign,
 *    deposit, status changes).
 *
 * 2. Polling fallback — refreshes server data every 30 seconds to catch
 *    any changes that don't go through the bridge table (direct edits to
 *    the `orders` table in Order Process).
 *
 * Drop this into any layout that should stay current with Order Process.
 */

const POLL_INTERVAL_MS = 30_000; // 30 seconds

export function RealtimeOrdersRefresh() {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefresh = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      router.refresh();
    }, 500);
  };

  useEffect(() => {
    // 1. Realtime: listen for bridge-table events (works with anon key)
    const channel = supabaseClient
      .channel("op-sync")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_processing_events",
        },
        () => scheduleRefresh()
      )
      // Also attempt direct orders table (will deliver events if/when
      // an anon SELECT policy is added to the orders table)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => scheduleRefresh()
      )
      .subscribe();

    // 2. Polling fallback for changes that bypass the bridge table
    const poll = setInterval(() => {
      router.refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabaseClient.removeChannel(channel);
      clearInterval(poll);
    };
  }, [router]);

  return null;
}
