"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";

interface StatusSelectProps {
  orderId: string;
  field: "wcStatus" | "lppStatus";
  value: string | null;
  options: { value: string; label: string; color?: string }[];
  canEdit: boolean;
  label: string;
}

const fieldLabels: Record<StatusSelectProps["field"], string> = {
  wcStatus: "WC Status",
  lppStatus: "LP&P Status",
};

export function StatusSelect({
  orderId,
  field,
  value,
  options,
  canEdit,
  label,
}: StatusSelectProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [optimisticValue, setOptimisticValue] = useState(value);

  const handleChange = async (newValue: string) => {
    if (!canEdit || isPending) return;

    // Convert empty string to null
    const valueToSet = newValue === "" ? null : newValue;
    setOptimisticValue(valueToSet);

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field,
          value: valueToSet,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update status");
      }

      addToast({
        title: "Status updated",
        description: `${fieldLabels[field]} set to ${valueToSet || "Not Set"}`,
        variant: "success",
      });

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      // Rollback on error
      setOptimisticValue(value);
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update status",
        variant: "destructive",
      });
    }
  };

  // Get current option for display
  const currentOption = options.find((opt) => opt.value === optimisticValue);

  // Determine badge color based on value
  const getBadgeVariant = (): "default" | "secondary" | "success" | "warning" | "destructive" | "info" | "outline" => {
    if (!optimisticValue) return "secondary";
    if (currentOption?.color === "green") return "success";
    if (currentOption?.color === "orange") return "warning";
    if (currentOption?.color === "gray") return "secondary";
    return "secondary";
  };

  if (!canEdit) {
    // Read-only display as colored Badge
    return (
      <Badge variant={getBadgeVariant()} title={label}>
        {optimisticValue || "-"}
      </Badge>
    );
  }

  // Editable dropdown
  return (
    <div className="relative" title={label}>
      <select
        value={optimisticValue || ""}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        className={`
          h-7 text-xs rounded-md border border-input bg-background px-2 py-0.5
          cursor-pointer hover:border-primary/50 transition-colors
          disabled:cursor-not-allowed disabled:opacity-50
          focus:outline-none focus:ring-1 focus:ring-ring
          ${isPending ? "animate-pulse" : ""}
        `}
      >
        <option value="">Not Set</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
