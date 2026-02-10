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

  // Check if current user (or original user if impersonating) is admin
  const canImpersonate =
    (originalUser?.roleName === "Admin") ||
    (!isImpersonating && session?.user?.roleName === "Admin");

  const startImpersonation = useCallback(
    async (userId: string) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/auth/impersonate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
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
    canImpersonate,
    startImpersonation,
    stopImpersonation,
    loading,
    error,
  };
}
