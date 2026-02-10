"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";

interface TicketStatusSelectProps {
  ticketId: string;
  currentStatus: string;
  canEdit: boolean;
}

const statuses = [
  { value: "OPEN", label: "Open", color: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "IN_PROGRESS", label: "In Progress", color: "bg-amber-100 text-amber-700 border-amber-300" },
  { value: "PENDING", label: "Pending", color: "bg-gray-100 text-gray-700 border-gray-300" },
  { value: "RESOLVED", label: "Resolved", color: "bg-green-100 text-green-700 border-green-300" },
  { value: "CLOSED", label: "Closed", color: "bg-slate-100 text-slate-700 border-slate-300" },
];

export function TicketStatusSelect({
  ticketId,
  currentStatus,
  canEdit,
}: TicketStatusSelectProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useState(currentStatus);

  const handleChange = async (newStatus: string) => {
    if (!canEdit || isPending || newStatus === optimisticStatus) return;

    const oldStatus = optimisticStatus;
    setOptimisticStatus(newStatus);

    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update status");
      }

      addToast({
        title: "Status Updated",
        description: `Ticket status changed to ${statuses.find(s => s.value === newStatus)?.label}`,
        variant: "success",
      });

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setOptimisticStatus(oldStatus);
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const currentConfig = statuses.find((s) => s.value === optimisticStatus);

  if (!canEdit) {
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border ${currentConfig?.color || "bg-gray-100"}`}
      >
        {currentConfig?.label || optimisticStatus}
      </span>
    );
  }

  return (
    <select
      value={optimisticStatus}
      onChange={(e) => handleChange(e.target.value)}
      disabled={isPending}
      className={`
        h-8 text-xs rounded-md border px-2 py-1
        cursor-pointer hover:border-primary/50 transition-colors
        disabled:cursor-not-allowed disabled:opacity-50
        focus:outline-none focus:ring-1 focus:ring-ring
        ${isPending ? "animate-pulse" : ""}
        ${currentConfig?.color || "bg-gray-100"}
      `}
    >
      {statuses.map((status) => (
        <option key={status.value} value={status.value}>
          {status.label}
        </option>
      ))}
    </select>
  );
}

interface TicketPrioritySelectProps {
  ticketId: string;
  currentPriority: string;
  canEdit: boolean;
}

const priorities = [
  { value: "LOW", label: "Low", color: "bg-gray-100 text-gray-700 border-gray-300" },
  { value: "NORMAL", label: "Normal", color: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "HIGH", label: "High", color: "bg-orange-100 text-orange-700 border-orange-300" },
  { value: "URGENT", label: "Urgent", color: "bg-red-100 text-red-700 border-red-300" },
];

export function TicketPrioritySelect({
  ticketId,
  currentPriority,
  canEdit,
}: TicketPrioritySelectProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [optimisticPriority, setOptimisticPriority] = useState(currentPriority);

  const handleChange = async (newPriority: string) => {
    if (!canEdit || isPending || newPriority === optimisticPriority) return;

    const oldPriority = optimisticPriority;
    setOptimisticPriority(newPriority);

    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: newPriority }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update priority");
      }

      addToast({
        title: "Priority Updated",
        description: `Ticket priority changed to ${priorities.find(p => p.value === newPriority)?.label}`,
        variant: "success",
      });

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setOptimisticPriority(oldPriority);
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update priority",
        variant: "destructive",
      });
    }
  };

  const currentConfig = priorities.find((p) => p.value === optimisticPriority);

  if (!canEdit) {
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border ${currentConfig?.color || "bg-gray-100"}`}
      >
        {currentConfig?.label || optimisticPriority}
      </span>
    );
  }

  return (
    <select
      value={optimisticPriority}
      onChange={(e) => handleChange(e.target.value)}
      disabled={isPending}
      className={`
        h-8 text-xs rounded-md border px-2 py-1
        cursor-pointer hover:border-primary/50 transition-colors
        disabled:cursor-not-allowed disabled:opacity-50
        focus:outline-none focus:ring-1 focus:ring-ring
        ${isPending ? "animate-pulse" : ""}
        ${currentConfig?.color || "bg-gray-100"}
      `}
    >
      {priorities.map((priority) => (
        <option key={priority.value} value={priority.value}>
          {priority.label}
        </option>
      ))}
    </select>
  );
}
