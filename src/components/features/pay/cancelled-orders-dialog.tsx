"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CancelledOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  totalPrice: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  salesRep: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

interface SalesRepOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface CancelledOrdersDialogProps {
  month: number;
  year: number;
  salesReps: SalesRepOption[];
  initialSalesRepId?: string;
  trigger?: React.ReactNode;
}

function formatCurrency(amount: number | string) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num || 0);
}

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function CancelledOrdersDialog({
  month,
  year,
  salesReps,
  initialSalesRepId,
  trigger,
}: CancelledOrdersDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [orders, setOrders] = React.useState<CancelledOrder[]>([]);
  const [selectedRepId, setSelectedRepId] = React.useState(initialSalesRepId || "");

  const fetchOrders = React.useCallback(async (repId?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        month: String(month),
        year: String(year),
      });
      if (repId) {
        params.set("salesRepId", repId);
      }
      const res = await fetch(`/api/pay/cancelled-orders?${params}`);
      const result = await res.json();
      if (result.success) {
        setOrders(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch cancelled orders:", error);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  React.useEffect(() => {
    if (open) {
      fetchOrders(selectedRepId || undefined);
    }
  }, [open, selectedRepId, fetchOrders]);

  const totalCancelled = orders.reduce(
    (sum, o) => sum + parseFloat(o.totalPrice || "0"),
    0
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            Cancelled Orders
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Cancelled Orders — {monthNames[month - 1]} {year}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium whitespace-nowrap">Filter by Rep:</label>
            <select
              value={selectedRepId}
              onChange={(e) => setSelectedRepId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm flex-1"
            >
              <option value="">All Sales Reps</option>
              {salesReps.map((rep) => (
                <option key={rep.id} value={rep.id}>
                  {rep.firstName} {rep.lastName}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : orders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No cancelled orders found for this period.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total Price</TableHead>
                    <TableHead>Cancel Date</TableHead>
                    <TableHead>Reason</TableHead>
                    {!selectedRepId && <TableHead>Sales Rep</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.orderNumber}</TableCell>
                      <TableCell>{order.customerName}</TableCell>
                      <TableCell className="text-right">{formatCurrency(order.totalPrice)}</TableCell>
                      <TableCell>
                        {order.cancelledAt
                          ? new Date(order.cancelledAt).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={order.cancelReason || ""}>
                        {order.cancelReason || "—"}
                      </TableCell>
                      {!selectedRepId && (
                        <TableCell>
                          {order.salesRep
                            ? `${order.salesRep.firstName} ${order.salesRep.lastName}`
                            : "—"}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm text-muted-foreground">
                  {orders.length} cancelled order{orders.length !== 1 ? "s" : ""}
                </span>
                <span className="text-sm font-semibold">
                  Total: {formatCurrency(totalCancelled)}
                </span>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
