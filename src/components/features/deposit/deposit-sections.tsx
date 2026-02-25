"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { DepositChargeSelect } from "@/components/features/deposit/deposit-charge-select";
import { formatCurrency, formatDate } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  depositAmount: string; // serialized Decimal
  totalPrice: string;    // serialized Decimal
  depositChargeStatus: string | null;
  depositNotes: string | null;
  dateSold: string | null; // serialized Date
  salesRep: { firstName: string; lastName: string } | null;
}

interface SectionMeta {
  badge: "info" | "warning" | "destructive" | "secondary" | "success";
  color: string;
}

// ---------------------------------------------------------------------------
// Shared constants (mirrored from page.tsx)
// ---------------------------------------------------------------------------

const SECTION_META: Record<string, SectionMeta> = {
  "Ready":                  { badge: "info",        color: "text-blue-600" },
  "Pending":                { badge: "warning",     color: "text-amber-600" },
  "On Hold":                { badge: "warning",     color: "text-amber-600" },
  "Declined":               { badge: "destructive", color: "text-red-600" },
  "Cancelled":              { badge: "secondary",   color: "text-gray-500" },
  "Other":                  { badge: "secondary",   color: "text-gray-500" },
  "Accepted After Decline": { badge: "success",     color: "text-emerald-600" },
  "Accepted":               { badge: "success",     color: "text-green-600" },
};

function classifyStatus(status: string | null): string {
  if (!status) return "Other";
  const s = status.toLowerCase().trim();
  if (s === "ready") return "Ready";
  if (s === "pending") return "Pending";
  if (s.startsWith("hold") || s === "hold") return "On Hold";
  if (s.includes("after decline")) return "Accepted After Decline";
  if (s.includes("decline")) return "Declined";
  if (s.startsWith("cancel") || s === "cancelled") return "Cancelled";
  return "Accepted";
}

// ---------------------------------------------------------------------------
// Table primitives
// ---------------------------------------------------------------------------

function TableHead() {
  return (
    <thead>
      <tr className="border-b bg-muted/50">
        <th className="px-4 py-3 text-left font-medium">Order #</th>
        <th className="px-4 py-3 text-left font-medium">Customer</th>
        <th className="px-4 py-3 text-left font-medium">Sales Rep</th>
        <th className="px-4 py-3 text-right font-medium">Deposit</th>
        <th className="px-4 py-3 text-right font-medium">Total Price</th>
        <th className="px-4 py-3 text-left font-medium">Charge Status</th>
        <th className="px-4 py-3 text-left font-medium">Date Sold</th>
        <th className="px-4 py-3 text-left font-medium">Notes</th>
        <th className="px-4 py-3 text-left font-medium">Actions</th>
      </tr>
    </thead>
  );
}

function OrderTableRows({ orders }: { orders: OrderRow[] }) {
  if (orders.length === 0) {
    return (
      <tr>
        <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
          No orders found
        </td>
      </tr>
    );
  }

  return (
    <>
      {orders.map((order) => {
        const section = classifyStatus(order.depositChargeStatus);
        const meta = SECTION_META[section] || SECTION_META["Other"];
        return (
          <tr key={order.id} className="border-b hover:bg-muted/30">
            <td className="px-4 py-3">
              <Link
                href={`/orders/${order.id}`}
                className="text-primary hover:underline font-medium"
              >
                {order.orderNumber}
              </Link>
            </td>
            <td className="px-4 py-3">
              <div>
                <p className="font-medium">{order.customerName}</p>
                <p className="text-xs text-muted-foreground">{order.customerEmail}</p>
              </div>
            </td>
            <td className="px-4 py-3">
              {order.salesRep
                ? `${order.salesRep.firstName} ${order.salesRep.lastName}`
                : "-"}
            </td>
            <td className="px-4 py-3 text-right">
              {formatCurrency(order.depositAmount)}
            </td>
            <td className="px-4 py-3 text-right">
              {formatCurrency(order.totalPrice)}
            </td>
            <td className="px-4 py-3">
              <DepositChargeSelect
                orderId={order.id}
                value={order.depositChargeStatus}
                canEdit
              />
            </td>
            <td className="px-4 py-3">
              {order.dateSold ? formatDate(order.dateSold) : "-"}
            </td>
            <td className="px-4 py-3">
              <span className="text-muted-foreground" title={order.depositNotes || ""}>
                {order.depositNotes
                  ? order.depositNotes.length > 50
                    ? `${order.depositNotes.slice(0, 50)}...`
                    : order.depositNotes
                  : "-"}
              </span>
            </td>
            <td className="px-4 py-3">
              <Link href={`/orders/${order.id}`}>
                <Button variant="ghost" size="sm">
                  View
                </Button>
              </Link>
            </td>
          </tr>
        );
      })}
    </>
  );
}

function OrderTable({ orders }: { orders: OrderRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <TableHead />
        <tbody>
          <OrderTableRows orders={orders} />
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grouped sections (Needs Action view)
// ---------------------------------------------------------------------------

interface GroupedSectionsProps {
  grouped: Record<string, OrderRow[]>;
  sectionOrder: string[];
  total: number;
}

export function GroupedSections({ grouped, sectionOrder, total }: GroupedSectionsProps) {
  const visibleSections = sectionOrder.filter(
    (section) => grouped[section]?.length
  );

  if (total === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No orders need action right now.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {visibleSections.map((section) => {
        const sectionOrders = grouped[section]!;
        const meta = SECTION_META[section] || SECTION_META["Other"];
        return (
          <Collapsible key={section} defaultOpen>
            <Card>
              <CardHeader className="pb-2">
                <CollapsibleTrigger>
                  <CardTitle className="flex items-center gap-2">
                    <span className={meta.color}>{section}</span>
                    <Badge variant={meta.badge} className="text-xs">
                      {sectionOrders.length}
                    </Badge>
                  </CardTitle>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="p-0">
                  <OrderTable orders={sectionOrders} />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Single-group filtered view
// ---------------------------------------------------------------------------

interface FilteredSectionProps {
  label: string;
  orders: OrderRow[];
  total: number;
  page: number;
  totalPages: number;
  activeGroup: string;
  activeSection: string;
  search: string;
}

export function FilteredSection({
  label,
  orders,
  total,
  page,
  totalPages,
  activeGroup,
  activeSection,
  search,
}: FilteredSectionProps) {
  function paginationHref(p: number) {
    const params = new URLSearchParams();
    if (activeSection !== "new-sales") params.set("section", activeSection);
    if (activeGroup) params.set("group", activeGroup);
    if (search) params.set("search", search);
    params.set("page", String(p));
    return `/deposit-status?${params.toString()}`;
  }

  return (
    <>
      <Collapsible defaultOpen>
        <Card>
          <CardHeader className="pb-2">
            <CollapsibleTrigger>
              <CardTitle className="flex items-center gap-2">
                {label}
                <Badge variant="secondary" className="text-xs">
                  {total}
                </Badge>
              </CardTitle>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="p-0">
              <OrderTable orders={orders} />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} orders)
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={paginationHref(page - 1)}>
                <Button variant="outline" size="sm">Previous</Button>
              </Link>
            )}
            {page < totalPages && (
              <Link href={paginationHref(page + 1)}>
                <Button variant="outline" size="sm">Next</Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
