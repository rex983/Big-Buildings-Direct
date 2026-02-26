"use client";

import { useSession } from "next-auth/react";
import { useCallback, useState } from "react";
import type { BaseSessionUser } from "@/types";

export function useImpersonation() {
  const { data: session, update } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isImpersonating = !!session?.user?.originalUser;
  const originalUser = session?.user?.originalUser;
  const impersonatingAs = session?.user?.impersonatingAs;

  const startImpersonation = useCallback(
    async (opts: string | { customerEmail: string; customerName: string }) => {
      setLoading(true);
      setError(null);

      try {
        const body =
          typeof opts === "string"
            ? { userId: opts }
            : { customerEmail: opts.customerEmail, customerName: opts.customerName };

        const response = await fetch("/api/auth/impersonate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!data.success) {
          setError(data.error || "Failed to start impersonation");
          return false;
        }

        // Update the session with impersonation data
        await update({
          impersonatingAs: data.data.impersonatingAs as BaseSessionUser,
        });

        return true;
      } catch (err) {
        setError("Failed to start impersonation");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [update]
  );

  const stopImpersonation = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/impersonate", {
        method: "DELETE",
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "Failed to stop impersonation");
        return false;
      }

      // Update the session to stop impersonation
      await update({ stopImpersonation: true });

      return true;
    } catch (err) {
      setError("Failed to stop impersonation");
      return false;
    } finally {
      setLoading(false);
    }
  }, [update]);

  return {
    isImpersonating,
    originalUser,
    impersonatingAs,
    startImpersonation,
    stopImpersonation,
    loading,
    error,
  };
}
