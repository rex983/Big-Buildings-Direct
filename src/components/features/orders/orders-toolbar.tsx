"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

const statusOptions = [
  { value: "", label: "All Statuses" },
  { value: "pending_payment", label: "Pending Payment" },
  { value: "sent_for_signature", label: "Sent to Customer" },
  { value: "signed", label: "Signed" },
  { value: "ready_for_manufacturer", label: "Sent to Mfr" },
  { value: "cancelled", label: "Cancelled" },
];

const paymentOptions = [
  { value: "", label: "All Payments" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "unpaid", label: "Unpaid" },
];

const sortOptions = [
  { value: "created_at:desc", label: "Newest First" },
  { value: "created_at:asc", label: "Oldest First" },
  { value: "orderNumber:desc", label: "Order # (High-Low)" },
  { value: "orderNumber:asc", label: "Order # (Low-High)" },
  { value: "totalPrice:desc", label: "Total (High-Low)" },
  { value: "totalPrice:asc", label: "Total (Low-High)" },
  { value: "customerName:asc", label: "Customer (A-Z)" },
  { value: "customerName:desc", label: "Customer (Z-A)" },
  { value: "salesPerson:asc", label: "Sales Rep (A-Z)" },
];

interface OrdersToolbarProps {
  states: string[];
  installers: string[];
  salesReps: string[];
  showSalesRepFilter: boolean;
}

export function OrdersToolbar({ states, installers, salesReps, showSalesRepFilter }: OrdersToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentStatus = searchParams.get("status") || "";
  const currentPayment = searchParams.get("payment") || "";
  const currentSort = searchParams.get("sort") || "created_at:desc";
  const currentState = searchParams.get("state") || "";
  const currentInstaller = searchParams.get("installer") || "";
  const currentSalesRep = searchParams.get("rep") || "";
  const currentSearch = searchParams.get("search") || "";

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams();
    // Preserve search
    if (currentSearch) params.set("search", currentSearch);

    // Merge current + updates
    const allFilters: Record<string, string> = {
      status: currentStatus,
      payment: currentPayment,
      sort: currentSort,
      state: currentState,
      installer: currentInstaller,
      rep: currentSalesRep,
      ...updates,
    };

    for (const [key, val] of Object.entries(allFilters)) {
      if (val && val !== "created_at:desc" || key === "sort" && val !== "created_at:desc") {
        if (val) params.set(key, val);
      }
    }
    // Always reset to page 1 when filters change
    router.push(`/orders${params.toString() ? `?${params.toString()}` : ""}`);
  }

  const hasFilters = currentStatus || currentPayment || currentState || currentInstaller || currentSalesRep;

  function clearFilters() {
    const params = new URLSearchParams();
    if (currentSearch) params.set("search", currentSearch);
    router.push(`/orders${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Sort */}
      <select
        value={currentSort}
        onChange={(e) => updateParams({ sort: e.target.value })}
        className="h-9 rounded-md border border-input bg-background px-2 py-1 text-sm"
      >
        {sortOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Status Filter */}
      <select
        value={currentStatus}
        onChange={(e) => updateParams({ status: e.target.value })}
        className="h-9 rounded-md border border-input bg-background px-2 py-1 text-sm"
      >
        {statusOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Payment Filter */}
      <select
        value={currentPayment}
        onChange={(e) => updateParams({ payment: e.target.value })}
        className="h-9 rounded-md border border-input bg-background px-2 py-1 text-sm"
      >
        {paymentOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* State Filter */}
      {states.length > 0 && (
        <select
          value={currentState}
          onChange={(e) => updateParams({ state: e.target.value })}
          className="h-9 rounded-md border border-input bg-background px-2 py-1 text-sm"
        >
          <option value="">All States</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      )}

      {/* Installer Filter */}
      {installers.length > 0 && (
        <select
          value={currentInstaller}
          onChange={(e) => updateParams({ installer: e.target.value })}
          className="h-9 rounded-md border border-input bg-background px-2 py-1 text-sm"
        >
          <option value="">All Installers</option>
          {installers.map((inst) => (
            <option key={inst} value={inst}>
              {inst}
            </option>
          ))}
        </select>
      )}

      {/* Sales Rep Filter */}
      {showSalesRepFilter && salesReps.length > 0 && (
        <select
          value={currentSalesRep}
          onChange={(e) => updateParams({ rep: e.target.value })}
          className="h-9 rounded-md border border-input bg-background px-2 py-1 text-sm"
        >
          <option value="">All Reps</option>
          {salesReps.map((rep) => (
            <option key={rep} value={rep}>
              {rep}
            </option>
          ))}
        </select>
      )}

      {/* Clear Filters */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear Filters
        </Button>
      )}
    </div>
  );
}
