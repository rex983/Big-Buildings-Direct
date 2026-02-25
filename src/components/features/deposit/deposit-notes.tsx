"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";

interface DepositNotesProps {
  orderId: string;
  value: string | null;
  canEdit: boolean;
}

export function DepositNotes({ orderId, value, canEdit }: DepositNotesProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");

  const handleSave = async () => {
    if (isPending) return;

    const noteValue = draft.trim() || null;

    try {
      const response = await fetch(`/api/orders/${orderId}/deposit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depositNotes: noteValue }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update deposit notes");
      }

      addToast({
        title: "Notes updated",
        description: "Deposit notes saved successfully",
        variant: "success",
      });

      setIsEditing(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update deposit notes",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setDraft(value || "");
    setIsEditing(false);
  };

  if (!canEdit) {
    return (
      <p className="text-sm text-muted-foreground">
        {value || "No notes"}
      </p>
    );
  }

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="text-sm text-muted-foreground hover:text-foreground text-left w-full"
      >
        {value || "No notes — click to add"}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={isPending}
        rows={3}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-ring"
        placeholder="Add deposit notes..."
        autoFocus
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving..." : "Save"}
        </Button>
        <Button size="sm" variant="outline" onClick={handleCancel} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
