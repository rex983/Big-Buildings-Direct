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

interface OrderLookupResult {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  buildingType: string;
  buildingSize: string;
  status: string;
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

export function CancelOrderByLookupDialog() {
  const router = useRouter();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Order lookup
  const [orderSearch, setOrderSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [matchedOrder, setMatchedOrder] = useState<OrderLookupResult | null>(null);
  const [orderError, setOrderError] = useState("");

  // Cancel fields
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setOrderSearch("");
    setMatchedOrder(null);
    setOrderError("");
    setReason("");
    setNotes("");
  };

  const handleOrderLookup = async () => {
    const trimmed = orderSearch.trim();
    if (!trimmed) {
      setOrderError("Please enter an order number");
      return;
    }

    setSearching(true);
    setOrderError("");
    setMatchedOrder(null);

    try {
      const response = await fetch(
        `/api/orders?search=${encodeURIComponent(trimmed)}&pageSize=5`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to search orders");
      }

      const orders = data.data?.items || [];
      const exact = orders.find(
        (o: { orderNumber: string }) =>
          o.orderNumber.toLowerCase() === trimmed.toLowerCase()
      );
      const match = exact || orders[0];

      if (!match) {
        setOrderError(`No order found matching "${trimmed}"`);
      } else if (match.status === "CANCELLED") {
        setOrderError(`Order ${match.orderNumber} is already cancelled`);
      } else {
        setMatchedOrder({
          id: match.id,
          orderNumber: match.orderNumber,
          customerName: match.customerName,
          customerEmail: match.customerEmail,
          buildingType: match.buildingType || "",
          buildingSize: match.buildingSize || "",
          status: match.status,
        });
      }
    } catch (error) {
      setOrderError(
        error instanceof Error ? error.message : "Failed to look up order"
      );
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!matchedOrder) {
      addToast({
        title: "Error",
        description: "Please look up an order first",
        variant: "destructive",
      });
      return;
    }

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
      const response = await fetch(`/api/orders/${matchedOrder.id}/cancel`, {
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
        description: `Order ${matchedOrder.orderNumber} has been cancelled`,
        variant: "success",
      });

      setOpen(false);
      resetForm();
      router.refresh();
    } catch (error) {
      addToast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to cancel order",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive">
          <svg
            className="h-4 w-4 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
          Cancel Order
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Cancel Order</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Order Lookup */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Order Number *</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => {
                  setOrderSearch(e.target.value);
                  setMatchedOrder(null);
                  setOrderError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleOrderLookup();
                  }
                }}
                placeholder="Enter order number (e.g. ORD-00123)"
                className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleOrderLookup}
                disabled={searching}
              >
                {searching ? "..." : "Look Up"}
              </Button>
            </div>
            {orderError && (
              <p className="text-sm text-red-600">{orderError}</p>
            )}
            {matchedOrder && (
              <div className="rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/50 p-3">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  {matchedOrder.orderNumber}
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {matchedOrder.customerName} &mdash; {matchedOrder.customerEmail}
                </p>
                {matchedOrder.buildingType && (
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {matchedOrder.buildingType} {matchedOrder.buildingSize}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Cancel fields (only shown after order is matched) */}
          {matchedOrder && (
            <>
              <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 p-3">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  This will cancel order {matchedOrder.orderNumber} for {matchedOrder.customerName}. This action can be reversed by an admin.
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
            </>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
              disabled={loading}
            >
              Go Back
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={loading || !matchedOrder || !reason}
            >
              {loading ? "Cancelling..." : "Cancel Order"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
