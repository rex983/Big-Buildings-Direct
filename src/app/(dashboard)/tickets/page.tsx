import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TicketGroupedList } from "@/components/features/tickets";

interface SearchParams {
  page?: string;
  search?: string;
  status?: string;
  type?: string;
  priority?: string;
  assignedToMe?: string;
}

const statuses = [
  { value: "", label: "All Statuses" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "PENDING", label: "Pending" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

const types = [
  { value: "", label: "All Types" },
  { value: "WELCOME_CALL", label: "Welcome Call" },
  { value: "LPP", label: "LP&P" },
  { value: "BUILDING_UPDATE", label: "Building Update" },
  { value: "INFO_UPDATE", label: "Info Update" },
  { value: "MANUFACTURER_CHANGE", label: "Mfr Change" },
  { value: "OTHER", label: "Other" },
];

const priorities = [
  { value: "", label: "All Priorities" },
  { value: "URGENT", label: "Urgent" },
  { value: "HIGH", label: "High" },
  { value: "NORMAL", label: "Normal" },
  { value: "LOW", label: "Low" },
];

async function getTickets(searchParams: SearchParams, userId: string) {
  const where: Record<string, unknown> = {};

  if (searchParams.status) {
    where.status = searchParams.status;
  }

  if (searchParams.type) {
    where.type = searchParams.type;
  }

  if (searchParams.priority) {
    where.priority = searchParams.priority;
  }

  if (searchParams.assignedToMe === "true") {
    where.assignedToId = userId;
  }

  if (searchParams.search) {
    where.OR = [
      { ticketNumber: { contains: searchParams.search } },
      { subject: { contains: searchParams.search } },
      { order: { orderNumber: { contains: searchParams.search } } },
      { order: { customerName: { contains: searchParams.search } } },
    ];
  }

  const page = parseInt(searchParams.page || "1", 10);
  const pageSize = 50;
  const skip = (page - 1) * pageSize;

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            customerPhone: true,
          },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: {
          select: { notes: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.ticket.count({ where }),
  ]);

  return { tickets, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

async function getTicketStats(userId: string) {
  const [open, inProgress, pending, assignedToMe] = await Promise.all([
    prisma.ticket.count({ where: { status: "OPEN" } }),
    prisma.ticket.count({ where: { status: "IN_PROGRESS" } }),
    prisma.ticket.count({ where: { status: "PENDING" } }),
    prisma.ticket.count({ where: { assignedToId: userId, status: { not: "CLOSED" } } }),
  ]);

  return { open, inProgress, pending, assignedToMe };
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const user = session!.user;

  // Only BST, Admin, and Manager can access tickets
  const allowedRoles = ["Admin", "Manager", "BST"];
  if (!allowedRoles.includes(user.roleName)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const [ticketResult, stats] = await Promise.all([
    getTickets(params, user.id),
    getTicketStats(user.id),
  ]);
  const { tickets, total, page, totalPages } = ticketResult;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tickets</h1>
          <p className="text-muted-foreground">
            Manage support tickets for orders ({total} total)
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Link href="/tickets?status=OPEN">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Open
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">{stats.open}</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/tickets?status=IN_PROGRESS">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                In Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-600">{stats.inProgress}</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/tickets?status=PENDING">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-600">{stats.pending}</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/tickets?assignedToMe=true">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Assigned to Me
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-purple-600">{stats.assignedToMe}</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Filters</CardTitle>
            <form className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                name="search"
                placeholder="Search tickets..."
                defaultValue={params.search}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              />
              <select
                name="status"
                defaultValue={params.status}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {statuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select
                name="type"
                defaultValue={params.type}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {types.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <select
                name="priority"
                defaultValue={params.priority}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {priorities.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <Button type="submit" size="sm">
                Filter
              </Button>
              {(params.search || params.status || params.type || params.priority || params.assignedToMe) && (
                <Link href="/tickets">
                  <Button type="button" variant="outline" size="sm">
                    Clear
                  </Button>
                </Link>
              )}
            </form>
          </div>
        </CardHeader>
      </Card>

      {/* Grouped Tickets */}
      <TicketGroupedList tickets={JSON.parse(JSON.stringify(tickets))} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} tickets)
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/tickets?page=${page - 1}&search=${params.search || ""}&status=${params.status || ""}&type=${params.type || ""}&priority=${params.priority || ""}`}
              >
                <Button variant="outline" size="sm">Previous</Button>
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/tickets?page=${page + 1}&search=${params.search || ""}&status=${params.status || ""}&type=${params.type || ""}&priority=${params.priority || ""}`}
              >
                <Button variant="outline" size="sm">Next</Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
