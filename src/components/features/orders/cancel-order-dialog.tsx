"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

interface CancelOrderDialogProps {
  orderId: string;
  orderNumber: string;
  customerName: string;
  trigger?: React.ReactNode;
}

const cancellationReasons = [
  { value: "Customer Changed Mind", label: "Customer Changed Mind" },
  { value: "Financial Issue", label: "Financial Issue" },
  { value: "Found Alternative", label: "Found Alternative" },
  { value: "Delivery Timeline", label: "Delivery Timeline" },
  { value: "Permit/Zoning Issues", label: "Permit/Zoning Issues" },
  { value: "Manufacturer Issue", label: "Manufacturer Issue" },
  { value: "Duplicate Order", label: "Duplicate Order" },
  { value: "Other", label: "Other" },
];

export function CancelOrderDialog({
  orderId,
  orderNumber,
  customerName,
  trigger,
}: CancelOrderDialogProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason) {
      addToast({
        title: "Error",
        description: "Please select a cancellation reason",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel order");
      }

      addToast({
        title: "Order Cancelled",
        description: `Order #${orderNumber} has been cancelled`,
        variant: "success",
      });

      setOpen(false);
      setReason("");
      setNotes("");

      router.refresh();
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cancel order",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="destructive" size="sm">
            Cancel Order
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Cancel Order #{orderNumber}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 p-3">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              This will cancel order #{orderNumber} for {customerName}. This action can be reversed by an admin.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Reason *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            >
              <option value="">Select a reason...</option>
              {cancellationReasons.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Additional Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details about the cancellation..."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Go Back
            </Button>
            <Button type="submit" variant="destructive" disabled={loading}>
              {loading ? "Cancelling..." : "Cancel Order"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
