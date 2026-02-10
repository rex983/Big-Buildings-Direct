import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime, formatDateTime, formatCurrency } from "@/lib/utils";
import {
  TicketStatusBadge,
  TicketPriorityBadge,
  TicketTypeBadge,
  TicketNotes,
  TicketActivity,
  TicketStatusSelect,
  TicketPrioritySelect,
} from "@/components/features/tickets";
import { TicketAssignSelect } from "@/components/features/tickets/ticket-assign-select";
import { FileAttachments } from "@/components/features/files";

async function getTicket(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          buildingType: true,
          buildingSize: true,
          deliveryAddress: true,
          deliveryCity: true,
          deliveryState: true,
          deliveryZip: true,
          installer: true,
          totalPrice: true,
          status: true,
          wcStatus: true,
          lppStatus: true,
          sentToManufacturerDate: true,
          salesRep: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      },
      createdBy: {
        select: { id: true, firstName: true, lastName: true },
      },
      assignedTo: {
        select: { id: true, firstName: true, lastName: true },
      },
      files: {
        include: {
          file: true,
        },
        orderBy: { createdAt: "desc" },
      },
      notes: {
        include: {
          author: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      activities: {
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return ticket;
}

async function getBstUsers() {
  return prisma.user.findMany({
    where: {
      role: {
        name: { in: ["Admin", "Manager", "BST"] },
      },
      isActive: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const session = await auth();
  const user = session!.user;

  // Only BST, Admin, and Manager can access tickets
  const allowedRoles = ["Admin", "Manager", "BST"];
  if (!allowedRoles.includes(user.roleName)) {
    redirect("/dashboard");
  }

  const { ticketId } = await params;
  const [ticket, bstUsers] = await Promise.all([
    getTicket(ticketId),
    getBstUsers(),
  ]);

  if (!ticket) {
    notFound();
  }

  const canEdit = user.roleName === "Admin" || user.roleName === "Manager" || user.roleName === "BST";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/tickets">
            <Button variant="ghost" size="sm">
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{ticket.ticketNumber}</h1>
              <TicketTypeBadge type={ticket.type} />
            </div>
            <p className="text-muted-foreground">{ticket.subject}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TicketStatusSelect
            ticketId={ticket.id}
            currentStatus={ticket.status}
            canEdit={canEdit}
          />
          <TicketPrioritySelect
            ticketId={ticket.id}
            currentPriority={ticket.priority}
            canEdit={canEdit}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {ticket.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{ticket.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Resolution (if resolved/closed) */}
          {ticket.resolution && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-green-700">Resolution</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{ticket.resolution}</p>
                {ticket.resolvedAt && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Resolved {formatRelativeTime(ticket.resolvedAt)}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <TicketNotes
            ticketId={ticket.id}
            notes={ticket.notes}
            canEdit={canEdit}
          />

          {/* Files */}
          <FileAttachments
            entityType="ticket"
            entityId={ticket.id}
            files={ticket.files}
            canUpload={canEdit}
            canDelete={canEdit}
          />

          {/* Activity Log */}
          <TicketActivity activities={ticket.activities} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Ticket Details */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <TicketStatusBadge status={ticket.status} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Priority</p>
                <TicketPriorityBadge priority={ticket.priority} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <TicketTypeBadge type={ticket.type} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Assigned To</p>
                <TicketAssignSelect
                  ticketId={ticket.id}
                  currentAssigneeId={ticket.assignedTo?.id || null}
                  users={bstUsers}
                  canEdit={canEdit}
                />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created By</p>
                <p className="font-medium">
                  {ticket.createdBy.firstName} {ticket.createdBy.lastName}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium" title={formatDateTime(ticket.createdAt)}>
                  {formatRelativeTime(ticket.createdAt)}
                </p>
              </div>
              {ticket.closedAt && (
                <div>
                  <p className="text-sm text-muted-foreground">Closed</p>
                  <p className="font-medium" title={formatDateTime(ticket.closedAt)}>
                    {formatRelativeTime(ticket.closedAt)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Information */}
          <Card>
            <CardHeader>
              <CardTitle>Order Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Order Number</p>
                <Link
                  href={`/orders/${ticket.order.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {ticket.order.orderNumber}
                </Link>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Customer</p>
                <p className="font-medium">{ticket.order.customerName}</p>
                {ticket.order.customerEmail && (
                  <a
                    href={`mailto:${ticket.order.customerEmail}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {ticket.order.customerEmail}
                  </a>
                )}
                {ticket.order.customerPhone && (
                  <a
                    href={`tel:${ticket.order.customerPhone}`}
                    className="text-sm text-primary hover:underline block"
                  >
                    {ticket.order.customerPhone}
                  </a>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Building</p>
                <p className="font-medium">
                  {ticket.order.buildingType} - {ticket.order.buildingSize}
                </p>
              </div>
              {ticket.order.deliveryAddress && (
                <div>
                  <p className="text-sm text-muted-foreground">Delivery Location</p>
                  <p className="font-medium">
                    {ticket.order.deliveryAddress}
                    <br />
                    {ticket.order.deliveryCity}, {ticket.order.deliveryState} {ticket.order.deliveryZip}
                  </p>
                </div>
              )}
              {ticket.order.installer && (
                <div>
                  <p className="text-sm text-muted-foreground">Installer</p>
                  <p className="font-medium">{ticket.order.installer}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Total Price</p>
                <p className="font-medium">{formatCurrency(ticket.order.totalPrice)}</p>
              </div>
              {ticket.order.salesRep && (
                <div>
                  <p className="text-sm text-muted-foreground">Sales Rep</p>
                  <p className="font-medium">
                    {ticket.order.salesRep.firstName} {ticket.order.salesRep.lastName}
                  </p>
                </div>
              )}

              {/* BST Status */}
              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-medium mb-2">BST Status</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">WC Status</span>
                    {ticket.order.wcStatus ? (
                      <Badge
                        variant={
                          ticket.order.wcStatus === "Contact Made"
                            ? "success"
                            : ticket.order.wcStatus === "No Contact Made"
                            ? "warning"
                            : "secondary"
                        }
                      >
                        {ticket.order.wcStatus}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">LP&P Status</span>
                    {ticket.order.lppStatus ? (
                      <Badge
                        variant={ticket.order.lppStatus === "Ready for Install" ? "success" : "secondary"}
                      >
                        {ticket.order.lppStatus}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Link href={`/orders/${ticket.order.id}`}>
                  <Button variant="outline" className="w-full">
                    View Full Order
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
