"use client";

import { useTestMode } from "@/contexts/test-mode-context";
import { useToast } from "@/components/ui/toast";
import { useCallback } from "react";

/**
 * A fetch wrapper that shows a toast when test mode intercepts a request.
 * Use this in components that make mutating API calls.
 *
 * Returns a wrapped fetch that behaves identically to regular fetch,
 * but shows a "simulated" toast when test mode is active and the
 * middleware returns a mock response.
 */
export function useTestFetch() {
  const { isTestMode } = useTestMode();
  const { addToast } = useToast();

  const testFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const response = await fetch(input, init);

      if (isTestMode && response.ok) {
        try {
          const cloned = response.clone();
          const data = await cloned.json();
          if (data.testMode) {
            addToast({
              title: "Test Mode",
              description: data.message || "Action simulated — no data was changed.",
              variant: "default",
            });
          }
        } catch {
          // Not JSON or parse error — ignore
        }
      }

      return response;
    },
    [isTestMode, addToast]
  );

  return { fetch: testFetch, isTestMode };
}
