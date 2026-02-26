import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getOrdersByCustomerEmail } from "@/lib/order-process";

interface TimelineEvent {
  date: string;
  type: "order_created" | "stage_change" | "ticket" | "cancellation";
  description: string;
  orderNumber: string;
  orderId: string;
}

const timelineBadges: Record<TimelineEvent["type"], { label: string; className: string }> = {
  order_created: { label: "Order", className: "bg-blue-100 text-blue-800" },
  stage_change: { label: "Update", className: "bg-gray-100 text-gray-800" },
  ticket: { label: "Ticket", className: "bg-yellow-100 text-yellow-800" },
  cancellation: { label: "Cancelled", className: "bg-red-100 text-red-800" },
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const session = await auth();
  if (!session) notFound();

  // customerId is a URL-encoded email address
  const email = decodeURIComponent(customerId).toLowerCase().trim();
  if (!email || !email.includes("@")) notFound();

  // Get all orders for this customer from Supabase (source of truth)
  const orders = await getOrdersByCustomerEmail(email);
  if (orders.length === 0) notFound();

  // Derive customer info from the most recent order
  const latest = orders[0];
  const customerName = latest.customerName;
  const customerPhone = latest.customerPhone;

  // Stats
  const totalOrders = orders.length;
  const totalValue = orders.reduce((sum, o) => sum + o.totalPrice, 0);
  const sentToMfr = orders.filter((o) => o.sentToManufacturer).length;

  // Get BBD-specific data (tickets, activities) from Prisma
  // These are linked by order ID which is shared between Supabase and Prisma
  const orderIds = orders.map((o) => o.id);

  const [tickets, activities] = await Promise.all([
    prisma.ticket.findMany({
      where: { orderId: { in: orderIds } },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        status: true,
        createdAt: true,
        orderId: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.orderActivity.findMany({
      where: { orderId: { in: orderIds }, type: { not: "ORDER_CREATED" } },
      select: {
        id: true,
        type: true,
        description: true,
        createdAt: true,
        orderId: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  // Build a lookup for order number by ID
  const orderNumberMap = new Map(orders.map((o) => [o.id, o.orderNumber]));

  // Build timeline
  const timeline: TimelineEvent[] = [];

  for (const order of orders) {
    timeline.push({
      date: order.createdAt,
      type: "order_created",
      description: `Order ${order.orderNumber} placed — ${order.buildingType} ${order.buildingSize}`.trim(),
      orderNumber: order.orderNumber,
      orderId: order.id,
    });

    if (order.cancelledAt) {
      timeline.push({
        date: order.cancelledAt,
        type: "cancellation",
        description: `Order ${order.orderNumber} cancelled${order.cancelReason ? ` — ${order.cancelReason}` : ""}`,
        orderNumber: order.orderNumber,
        orderId: order.id,
      });
    }
  }

  for (const activity of activities) {
    timeline.push({
      date: activity.createdAt.toISOString(),
      type: "stage_change",
      description: activity.description,
      orderNumber: orderNumberMap.get(activity.orderId) || "",
      orderId: activity.orderId,
    });
  }

  for (const ticket of tickets) {
    timeline.push({
      date: ticket.createdAt.toISOString(),
      type: "ticket",
      description: `Ticket ${ticket.ticketNumber} created: ${ticket.subject}`,
      orderNumber: orderNumberMap.get(ticket.orderId) || "",
      orderId: ticket.orderId,
    });
  }

  // Sort newest first
  timeline.sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link href="/customers" className="hover:underline">
            Customers
          </Link>
          <span>/</span>
          <span>{customerName}</span>
        </div>
        <h1 className="text-3xl font-bold">{customerName}</h1>
        <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
          <span>{email}</span>
          {customerPhone && <span>{customerPhone}</span>}
          <span>First order {formatDate(orders[orders.length - 1].createdAt)}</span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Orders</p>
            <p className="text-2xl font-bold">{totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Value</p>
            <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Sent to Manufacturer</p>
            <p className="text-2xl font-bold">{sentToMfr}</p>
          </CardContent>
        </Card>
      </div>

      {/* Customer Journey Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Journey</CardTitle>
        </CardHeader>
        <CardContent>
          {timeline.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No activity recorded yet
            </p>
          ) : (
            <div className="relative border-l-2 border-muted ml-4 space-y-6">
              {timeline.slice(0, 50).map((event, i) => {
                const badge = timelineBadges[event.type];
                return (
                  <div key={i} className="relative pl-6">
                    <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                            {badge.label}
                          </span>
                          <Link
                            href={`/orders/${event.orderId}`}
                            className="text-xs text-primary hover:underline"
                          >
                            {event.orderNumber}
                          </Link>
                        </div>
                        <p className="text-sm">{event.description}</p>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(event.date)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Building</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Sales Person</TableHead>
                <TableHead>Date Sold</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <Link
                      href={`/orders/${order.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span>{order.buildingType}</span>
                    {order.buildingSize && (
                      <span className="text-muted-foreground ml-1">
                        {order.buildingSize}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      style={{
                        borderColor: order.currentStage.color,
                        color: order.currentStage.color,
                      }}
                    >
                      {order.currentStage.name}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatCurrency(order.totalPrice)}</TableCell>
                  <TableCell>
                    <span className="text-sm">{order.salesPerson || "—"}</span>
                  </TableCell>
                  <TableCell>
                    {formatDate(order.dateSold || order.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
