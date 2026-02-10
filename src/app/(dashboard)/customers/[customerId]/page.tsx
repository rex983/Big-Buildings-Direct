import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatDateTime, truncate } from "@/lib/utils";
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

async function getCustomer(customerId: string) {
  return prisma.user.findUnique({
    where: { id: customerId },
    include: {
      role: { select: { name: true } },
      customerOrders: {
        include: {
          currentStage: true,
          salesRep: { select: { firstName: true, lastName: true } },
          activities: { orderBy: { createdAt: "desc" }, take: 10 },
          tickets: {
            select: {
              id: true,
              ticketNumber: true,
              subject: true,
              status: true,
              type: true,
              createdAt: true,
            },
          },
          revisions: {
            select: {
              id: true,
              revisionNumber: true,
              revisionDate: true,
              changeInPrice: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

interface TimelineEvent {
  date: Date;
  type: "order_created" | "stage_change" | "ticket" | "revision" | "cancellation";
  description: string;
  orderNumber: string;
  orderId: string;
}

function buildTimeline(
  orders: NonNullable<Awaited<ReturnType<typeof getCustomer>>>["customerOrders"]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const order of orders) {
    // Order created
    events.push({
      date: order.createdAt,
      type: "order_created",
      description: `Order ${order.orderNumber} placed — ${order.buildingType} ${order.buildingSize}`,
      orderNumber: order.orderNumber,
      orderId: order.id,
    });

    // Stage changes from activities
    for (const activity of order.activities) {
      if (activity.type !== "ORDER_CREATED") {
        events.push({
          date: activity.createdAt,
          type: "stage_change",
          description: activity.description,
          orderNumber: order.orderNumber,
          orderId: order.id,
        });
      }
    }

    // Tickets
    for (const ticket of order.tickets) {
      events.push({
        date: ticket.createdAt,
        type: "ticket",
        description: `Ticket ${ticket.ticketNumber} created: ${ticket.subject}`,
        orderNumber: order.orderNumber,
        orderId: order.id,
      });
    }

    // Revisions
    for (const revision of order.revisions) {
      events.push({
        date: revision.revisionDate,
        type: "revision",
        description: `Revision ${revision.revisionNumber} on order ${order.orderNumber}`,
        orderNumber: order.orderNumber,
        orderId: order.id,
      });
    }

    // Cancellation
    if (order.status === "CANCELLED" && order.cancelledAt) {
      events.push({
        date: order.cancelledAt,
        type: "cancellation",
        description: `Order ${order.orderNumber} cancelled${order.cancelReason ? ` — ${order.cancelReason}` : ""}`,
        orderNumber: order.orderNumber,
        orderId: order.id,
      });
    }
  }

  // Sort by date descending (newest first)
  events.sort((a, b) => b.date.getTime() - a.date.getTime());
  return events;
}

const timelineIcons: Record<TimelineEvent["type"], string> = {
  order_created: "📦",
  stage_change: "🔄",
  ticket: "🎫",
  revision: "📝",
  cancellation: "❌",
};

const statusColors: Record<string, string> = {
  ACTIVE: "info",
  COMPLETED: "success",
  CANCELLED: "destructive",
  ON_HOLD: "warning",
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const session = await auth();
  if (!session) notFound();

  const customer = await getCustomer(customerId);
  if (!customer) notFound();

  const orders = customer.customerOrders;
  const timeline = buildTimeline(orders);

  // Stats
  const totalOrders = orders.length;
  const totalValue = orders.reduce(
    (sum, o) => sum + Number(o.totalPrice),
    0
  );
  const activeOrders = orders.filter(
    (o) => o.status === "ACTIVE"
  ).length;
  const completedOrders = orders.filter(
    (o) => o.status === "COMPLETED" || o.sentToManufacturer
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link href="/customers" className="hover:underline">
            Customers
          </Link>
          <span>/</span>
          <span>{customer.firstName} {customer.lastName}</span>
        </div>
        <h1 className="text-3xl font-bold">
          {customer.firstName} {customer.lastName}
        </h1>
        <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
          <span>{customer.email}</span>
          {customer.phone && <span>{customer.phone}</span>}
          <span>ID: {truncate(customer.id, 12)}</span>
          <span>Member since {formatDate(customer.createdAt)}</span>
          <Badge variant="secondary">{customer.role.name}</Badge>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <p className="text-sm text-muted-foreground">Active Orders</p>
            <p className="text-2xl font-bold">{activeOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Completed / Installed</p>
            <p className="text-2xl font-bold">{completedOrders}</p>
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
              {timeline.map((event, i) => (
                <div key={i} className="relative pl-6">
                  <div className="absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-background border-2 border-muted flex items-center justify-center text-xs">
                    {timelineIcons[event.type]}
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm">{event.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(event.date)}
                        </span>
                        <Link
                          href={`/orders/${event.orderId}`}
                          className="text-xs text-primary hover:underline"
                        >
                          {event.orderNumber}
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
          {orders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No orders found
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Building</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Value</TableHead>
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
                      <Badge variant={statusColors[order.status] as "default"}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {order.currentStage ? (
                        <Badge variant="outline">{order.currentStage.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(order.totalPrice.toString())}
                    </TableCell>
                    <TableCell>
                      {order.dateSold
                        ? formatDate(order.dateSold)
                        : formatDate(order.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
