"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";

interface StatusCheckboxProps {
  orderId: string;
  field: "depositCollected" | "sentToCustomer" | "customerSigned" | "sentToManufacturer";
  checked: boolean;
  canEdit: boolean;
  label: string;
}

const fieldLabels: Record<StatusCheckboxProps["field"], string> = {
  depositCollected: "Deposit Collected",
  sentToCustomer: "Sent to Customer",
  customerSigned: "Customer Signed",
  sentToManufacturer: "Sent to Manufacturer",
};

export function StatusCheckbox({
  orderId,
  field,
  checked,
  canEdit,
  label,
}: StatusCheckboxProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [optimisticChecked, setOptimisticChecked] = useState(checked);

  const handleToggle = async () => {
    if (!canEdit || isPending) return;

    const newValue = !optimisticChecked;
    setOptimisticChecked(newValue);

    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field,
          value: newValue,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update status");
      }

      addToast({
        title: "Status updated",
        description: `${fieldLabels[field]} ${newValue ? "checked" : "unchecked"}`,
        variant: "success",
      });

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      // Rollback on error
      setOptimisticChecked(!newValue);
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update status",
        variant: "destructive",
      });
    }
  };

  if (!canEdit) {
    // Read-only display
    return (
      <div className="flex flex-col items-center gap-0.5" title={label}>
        {optimisticChecked ? (
          <svg
            className="h-5 w-5 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        ) : (
          <svg
            className="h-5 w-5 text-muted-foreground/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="12" cy="12" r="9" />
          </svg>
        )}
      </div>
    );
  }

  // Editable checkbox
  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isPending}
      className="flex flex-col items-center gap-0.5 cursor-pointer hover:opacity-80 transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
      title={`${label} - Click to toggle`}
    >
      {isPending ? (
        <svg
          className="h-5 w-5 text-muted-foreground animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : optimisticChecked ? (
        <svg
          className="h-5 w-5 text-green-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ) : (
        <svg
          className="h-5 w-5 text-muted-foreground/40 hover:text-muted-foreground/60"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <circle cx="12" cy="12" r="9" />
        </svg>
      )}
    </button>
  );
}
