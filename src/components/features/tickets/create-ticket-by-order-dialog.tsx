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
}

const ticketTypes = [
  { value: "WELCOME_CALL", label: "Welcome Call" },
  { value: "LPP", label: "Land, Pad & Permit" },
  { value: "BUILDING_UPDATE", label: "Building Update" },
  { value: "INFO_UPDATE", label: "Information Update" },
  { value: "MANUFACTURER_CHANGE", label: "Manufacturer Change" },
  { value: "OTHER", label: "Other" },
];

const priorities = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

export function CreateTicketByOrderDialog() {
  const router = useRouter();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Order lookup
  const [orderSearch, setOrderSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [matchedOrder, setMatchedOrder] = useState<OrderLookupResult | null>(null);
  const [orderError, setOrderError] = useState("");

  // Ticket fields
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("OTHER");
  const [priority, setPriority] = useState("NORMAL");

  const resetForm = () => {
    setOrderSearch("");
    setMatchedOrder(null);
    setOrderError("");
    setSubject("");
    setDescription("");
    setType("OTHER");
    setPriority("NORMAL");
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
      const response = await fetch(`/api/orders?search=${encodeURIComponent(trimmed)}&pageSize=5`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to search orders");
      }

      const orders = data.data?.items || [];
      // Find exact match first, then partial
      const exact = orders.find(
        (o: { orderNumber: string }) => o.orderNumber.toLowerCase() === trimmed.toLowerCase()
      );
      const match = exact || orders[0];

      if (!match) {
        setOrderError(`No order found matching "${trimmed}"`);
      } else {
        setMatchedOrder({
          id: match.id,
          orderNumber: match.orderNumber,
          customerName: match.customerName,
          customerEmail: match.customerEmail,
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

    if (!subject.trim()) {
      addToast({
        title: "Error",
        description: "Subject is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: matchedOrder.id,
          subject: subject.trim(),
          description: description.trim() || undefined,
          type,
          priority,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create ticket");
      }

      addToast({
        title: "Ticket Created",
        description: `Ticket ${data.data.ticketNumber} created for order ${matchedOrder.orderNumber}`,
        variant: "success",
      });

      setOpen(false);
      resetForm();
      router.refresh();
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create ticket",
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
        <Button size="sm">
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
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          New Ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Ticket</DialogTitle>
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
              </div>
            )}
          </div>

          {/* Ticket fields (only shown after order is matched) */}
          {matchedOrder && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Subject *</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief description of the issue"
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {ticketTypes.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {priorities.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Additional details about the issue..."
                  rows={4}
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
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !matchedOrder}>
              {loading ? "Creating..." : "Create Ticket"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
