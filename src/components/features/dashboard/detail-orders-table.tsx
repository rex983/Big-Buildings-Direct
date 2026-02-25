import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { DetailPageOrder } from "@/lib/queries/detail-pages";

interface DetailOrdersTableProps {
  orders: DetailPageOrder[];
  showSalesRep?: boolean;
  showManufacturer?: boolean;
  showState?: boolean;
}

export function DetailOrdersTable({
  orders,
  showSalesRep = false,
  showManufacturer = false,
  showState = false,
}: DetailOrdersTableProps) {
  if (orders.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">No orders found.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left p-3 font-medium">Order #</th>
            <th className="text-left p-3 font-medium">Customer</th>
            <th className="text-left p-3 font-medium">Building</th>
            {showSalesRep && (
              <th className="text-left p-3 font-medium">Sales Rep</th>
            )}
            {showManufacturer && (
              <th className="text-left p-3 font-medium">Manufacturer</th>
            )}
            {showState && (
              <th className="text-left p-3 font-medium">State</th>
            )}
            <th className="text-right p-3 font-medium">Total Price</th>
            <th className="text-right p-3 font-medium">Deposit</th>
            <th className="text-left p-3 font-medium">Date Sold</th>
            <th className="text-center p-3 font-medium">Sent to Mfr</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="p-3">
                <Link
                  href={`/orders/${order.id}`}
                  className="text-primary hover:underline font-medium"
                >
                  {order.orderNumber}
                </Link>
              </td>
              <td className="p-3">{order.customerName}</td>
              <td className="p-3">
                {order.buildingType} {order.buildingSize}
              </td>
              {showSalesRep && (
                <td className="p-3">
                  {order.salesRep
                    ? `${order.salesRep.firstName} ${order.salesRep.lastName}`
                    : "—"}
                </td>
              )}
              {showManufacturer && (
                <td className="p-3">{order.installer || "—"}</td>
              )}
              {showState && (
                <td className="p-3">{order.deliveryState}</td>
              )}
              <td className="p-3 text-right">
                {formatCurrency(order.totalPrice.toString())}
              </td>
              <td className="p-3 text-right">
                <span>{formatCurrency(order.depositAmount.toString())}</span>
                {order.depositCollected && (
                  <Badge variant="success" className="ml-2 text-xs">
                    Collected
                  </Badge>
                )}
              </td>
              <td className="p-3">
                {order.dateSold ? formatDate(order.dateSold) : "—"}
              </td>
              <td className="p-3 text-center">
                {order.sentToManufacturer ? "✓" : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
