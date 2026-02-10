"use client";

import { useImpersonation } from "@/hooks";
import { Button } from "@/components/ui/button";

export function ImpersonationBanner() {
  const { isImpersonating, impersonatingAs, stopImpersonation, loading } =
    useImpersonation();

  if (!isImpersonating || !impersonatingAs) {
    return null;
  }

  const handleExit = async () => {
    const success = await stopImpersonation();
    if (success) {
      // Redirect to dashboard after exiting impersonation
      window.location.href = "/dashboard";
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-4 bg-amber-500 px-4 py-2 text-amber-950">
      <span className="text-sm font-medium">
        Viewing as{" "}
        <strong>
          {impersonatingAs.firstName} {impersonatingAs.lastName}
        </strong>{" "}
        ({impersonatingAs.roleName})
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExit}
        disabled={loading}
        className="h-7 border-amber-700 bg-amber-100 text-amber-900 hover:bg-amber-200"
      >
        {loading ? "Exiting..." : "Exit View"}
      </Button>
    </div>
  );
}
