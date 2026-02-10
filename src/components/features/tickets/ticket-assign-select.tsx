"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";

interface User {
  id: string;
  firstName: string;
  lastName: string;
}

interface TicketAssignSelectProps {
  ticketId: string;
  currentAssigneeId: string | null;
  users: User[];
  canEdit: boolean;
}

export function TicketAssignSelect({
  ticketId,
  currentAssigneeId,
  users,
  canEdit,
}: TicketAssignSelectProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [optimisticAssigneeId, setOptimisticAssigneeId] = useState(currentAssigneeId);

  const currentAssignee = users.find((u) => u.id === optimisticAssigneeId);

  const handleChange = async (newAssigneeId: string) => {
    if (!canEdit || isPending) return;

    const oldAssigneeId = optimisticAssigneeId;
    const newValue = newAssigneeId === "" ? null : newAssigneeId;
    setOptimisticAssigneeId(newValue);

    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId: newValue }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update assignment");
      }

      const newAssignee = users.find((u) => u.id === newValue);
      addToast({
        title: newValue ? "Ticket Assigned" : "Ticket Unassigned",
        description: newValue
          ? `Ticket assigned to ${newAssignee?.firstName} ${newAssignee?.lastName}`
          : "Ticket is now unassigned",
        variant: "success",
      });

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setOptimisticAssigneeId(oldAssigneeId);
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update assignment",
        variant: "destructive",
      });
    }
  };

  if (!canEdit) {
    return (
      <span className="font-medium">
        {currentAssignee
          ? `${currentAssignee.firstName} ${currentAssignee.lastName}`
          : "Unassigned"}
      </span>
    );
  }

  return (
    <select
      value={optimisticAssigneeId || ""}
      onChange={(e) => handleChange(e.target.value)}
      disabled={isPending}
      className={`
        h-8 text-sm rounded-md border border-input bg-background px-2 py-1
        cursor-pointer hover:border-primary/50 transition-colors
        disabled:cursor-not-allowed disabled:opacity-50
        focus:outline-none focus:ring-1 focus:ring-ring
        ${isPending ? "animate-pulse" : ""}
      `}
    >
      <option value="">Unassigned</option>
      {users.map((user) => (
        <option key={user.id} value={user.id}>
          {user.firstName} {user.lastName}
        </option>
      ))}
    </select>
  );
}
