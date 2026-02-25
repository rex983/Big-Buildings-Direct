"use client";

import { useSession } from "next-auth/react";
import { useTestMode } from "@/contexts/test-mode-context";
import { Button } from "@/components/ui/button";

export function TestModeBanner() {
  const { data: session } = useSession();
  const { isTestMode, toggleTestMode, disableTestMode } = useTestMode();

  const isAdmin = session?.user?.roleName === "Admin";

  // Only admins can see the toggle
  if (!isAdmin) return null;

  if (!isTestMode) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          size="sm"
          variant="outline"
          onClick={toggleTestMode}
          className="rounded-full border-orange-300 bg-white px-4 py-2 text-xs font-medium text-orange-700 shadow-lg hover:bg-orange-50 dark:border-orange-700 dark:bg-gray-900 dark:text-orange-400 dark:hover:bg-gray-800"
        >
          Enable Test Mode
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-4 bg-orange-500 px-4 py-2 text-white">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-white" />
        <span className="text-sm font-bold tracking-wide">TEST MODE</span>
        <span className="text-sm">
          — All actions are simulated. Nothing is saved.
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={disableTestMode}
        className="h-7 border-orange-300 bg-orange-100 text-orange-900 hover:bg-orange-200"
      >
        Exit Test Mode
      </Button>
    </div>
  );
}
