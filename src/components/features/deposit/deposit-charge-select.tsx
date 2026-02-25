"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";

const STATUS_OPTIONS = [
  { value: "Accepted", label: "Accepted" },
  { value: "Accepted After Decline", label: "Accepted After Decline" },
  { value: "Declined", label: "Declined" },
  { value: "Hold", label: "Hold" },
  { value: "Ready", label: "Ready" },
  { value: "Refunded", label: "Refunded" },
];

function getBadgeVariant(
  status: string | null
): "default" | "secondary" | "success" | "warning" | "destructive" | "info" | "outline" {
  switch (status) {
    case "Accepted":
      return "success";
    case "Accepted After Decline":
      return "success";
    case "Declined":
      return "destructive";
    case "Hold":
      return "warning";
    case "Ready":
      return "info";
    case "Refunded":
      return "warning";
    default:
      return "secondary";
  }
}

interface DepositChargeSelectProps {
  orderId: string;
  value: string | null;
  canEdit: boolean;
}

export function DepositChargeSelect({ orderId, value, canEdit }: DepositChargeSelectProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [optimisticValue, setOptimisticValue] = useState(value);

  const handleChange = async (newValue: string) => {
    if (!canEdit || isPending) return;

    const valueToSet = newValue === "" ? null : newValue;
    setOptimisticValue(valueToSet);

    try {
      const response = await fetch(`/api/orders/${orderId}/deposit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depositChargeStatus: valueToSet }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update deposit status");
      }

      addToast({
        title: "Deposit status updated",
        description: `Charge status set to ${valueToSet || "Not Set"}`,
        variant: "success",
      });

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setOptimisticValue(value);
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update deposit status",
        variant: "destructive",
      });
    }
  };

  if (!canEdit) {
    return (
      <Badge variant={getBadgeVariant(optimisticValue)}>
        {optimisticValue || "-"}
      </Badge>
    );
  }

  return (
    <div className="relative">
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
        <option value="" disabled>Select status...</option>
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
