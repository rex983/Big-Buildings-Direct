"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import {
  TicketStatusBadge,
  TicketPriorityBadge,
  TicketTypeBadge,
} from "./ticket-status-badge";

interface TicketItem {
  id: string;
  ticketNumber: string;
  subject: string;
  type: string;
  status: string;
  priority: string;
  createdAt: string | Date;
  order: {
    id: string;
    orderNumber: string;
    customerName: string;
    customerPhone: string | null;
  };
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  assignedTo: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  _count: {
    notes: number;
  };
}

interface TicketGroupedListProps {
  tickets: TicketItem[];
}

const statusOrder = ["OPEN", "IN_PROGRESS", "PENDING", "RESOLVED", "CLOSED"];
const statusLabels: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  PENDING: "Pending",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};
const statusColors: Record<string, string> = {
  OPEN: "border-blue-500/40 bg-blue-500/5",
  IN_PROGRESS: "border-amber-500/40 bg-amber-500/5",
  PENDING: "border-gray-400/40 bg-gray-400/5",
  RESOLVED: "border-green-500/40 bg-green-500/5",
  CLOSED: "border-slate-400/40 bg-slate-400/5",
};
const statusTextColors: Record<string, string> = {
  OPEN: "text-blue-600",
  IN_PROGRESS: "text-amber-600",
  PENDING: "text-gray-600",
  RESOLVED: "text-green-600",
  CLOSED: "text-slate-500",
};

const priorityOrder = ["URGENT", "HIGH", "NORMAL", "LOW"];
const priorityLabels: Record<string, string> = {
  URGENT: "Urgent",
  HIGH: "High",
  NORMAL: "Normal",
  LOW: "Low",
};
const priorityColors: Record<string, string> = {
  URGENT: "border-red-500/40 bg-red-500/5",
  HIGH: "border-orange-500/40 bg-orange-500/5",
  NORMAL: "border-blue-400/40 bg-blue-400/5",
  LOW: "border-gray-300/40 bg-gray-300/5",
};
const priorityTextColors: Record<string, string> = {
  URGENT: "text-red-600",
  HIGH: "text-orange-600",
  NORMAL: "text-blue-600",
  LOW: "text-gray-500",
};

function TicketTable({ tickets }: { tickets: TicketItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ticket #</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>Order</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Assigned To</TableHead>
          <TableHead>Created</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tickets.map((ticket) => (
          <TableRow key={ticket.id}>
            <TableCell className="font-medium">
              <Link
                href={`/tickets/${ticket.id}`}
                className="hover:underline text-primary"
              >
                {ticket.ticketNumber}
              </Link>
            </TableCell>
            <TableCell>
              <div className="max-w-[200px]">
                <p className="truncate">{ticket.subject}</p>
                {ticket._count.notes > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {ticket._count.notes} note{ticket._count.notes !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div>
                <Link
                  href={`/orders/${ticket.order.id}`}
                  className="hover:underline text-primary"
                >
                  {ticket.order.orderNumber}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {ticket.order.customerName}
                </p>
              </div>
            </TableCell>
            <TableCell>
              <TicketTypeBadge type={ticket.type} size="sm" />
            </TableCell>
            <TableCell>
              <TicketPriorityBadge priority={ticket.priority} size="sm" />
            </TableCell>
            <TableCell>
              {ticket.assignedTo ? (
                <span className="text-sm">
                  {ticket.assignedTo.firstName} {ticket.assignedTo.lastName}
                </span>
              ) : (
                <span className="text-muted-foreground text-sm">Unassigned</span>
              )}
            </TableCell>
            <TableCell>
              <span className="text-sm text-muted-foreground">
                {formatRelativeTime(ticket.createdAt)}
              </span>
            </TableCell>
            <TableCell>
              <Link href={`/tickets/${ticket.id}`}>
                <Button variant="ghost" size="sm">
                  View
                </Button>
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function TicketGroupedList({ tickets }: TicketGroupedListProps) {
  // Group tickets: status → priority → tickets[]
  const grouped = new Map<string, Map<string, TicketItem[]>>();

  for (const ticket of tickets) {
    if (!grouped.has(ticket.status)) {
      grouped.set(ticket.status, new Map());
    }
    const priorityMap = grouped.get(ticket.status)!;
    if (!priorityMap.has(ticket.priority)) {
      priorityMap.set(ticket.priority, []);
    }
    priorityMap.get(ticket.priority)!.push(ticket);
  }

  // Sort within each priority group by createdAt desc
  for (const priorityMap of grouped.values()) {
    for (const list of priorityMap.values()) {
      list.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
  }

  const orderedStatuses = statusOrder.filter((s) => grouped.has(s));

  if (orderedStatuses.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        No tickets found
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {orderedStatuses.map((status) => {
        const priorityMap = grouped.get(status)!;
        const statusTotal = Array.from(priorityMap.values()).reduce(
          (sum, arr) => sum + arr.length,
          0
        );
        const orderedPriorities = priorityOrder.filter((p) =>
          priorityMap.has(p)
        );
        // Default open for active statuses, closed for resolved/closed
        const defaultOpen = status !== "CLOSED" && status !== "RESOLVED";

        return (
          <Collapsible key={status} defaultOpen={defaultOpen}>
            <Card className={`border ${statusColors[status] || ""}`}>
              <CardHeader className="py-3">
                <CollapsibleTrigger className="py-0">
                  <div className="flex items-center gap-3">
                    <TicketStatusBadge status={status} />
                    <span className={`font-semibold ${statusTextColors[status] || ""}`}>
                      {statusLabels[status] || status}
                    </span>
                    <Badge variant="outline" className="ml-1">
                      {statusTotal}
                    </Badge>
                  </div>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-3">
                  {orderedPriorities.map((priority) => {
                    const priorityTickets = priorityMap.get(priority)!;

                    return (
                      <Collapsible key={priority} defaultOpen={true}>
                        <div
                          className={`rounded-lg border ${priorityColors[priority] || ""}`}
                        >
                          <div className="px-4 py-2">
                            <CollapsibleTrigger>
                              <div className="flex items-center gap-2">
                                <TicketPriorityBadge priority={priority} size="sm" />
                                <span
                                  className={`text-sm font-medium ${priorityTextColors[priority] || ""}`}
                                >
                                  {priorityLabels[priority] || priority}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  ({priorityTickets.length})
                                </span>
                              </div>
                            </CollapsibleTrigger>
                          </div>
                          <CollapsibleContent>
                            <div className="px-2 pb-2">
                              <TicketTable tickets={priorityTickets} />
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}
