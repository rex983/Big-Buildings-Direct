import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { GroupedSections, FilteredSection } from "@/components/features/deposit/deposit-sections";

interface SearchParams {
  page?: string;
  search?: string;
  group?: string;
  section?: string;
}

// ---------------------------------------------------------------------------
// Order sections (New Sales / Revisions / Order Changes / Cancellations)
// ---------------------------------------------------------------------------

const SECTIONS = [
  { key: "new-sales",      label: "New Sales" },
  { key: "revisions",      label: "Revisions" },
  { key: "order-changes",  label: "Order Changes" },
  { key: "cancellations",  label: "Cancellations" },
] as const;

/**
 * Build the Prisma WHERE fragment for a given section.
 * Priority: Cancellation > Order Change > Revision > New Sale
 */
function buildSectionWhere(section: string): Record<string, unknown> {
  switch (section) {
    case "cancellations":
      return { status: "CANCELLED" };
    case "order-changes":
      // Has order changes AND is not cancelled
      return { orderChanges: { some: {} }, status: { not: "CANCELLED" } };
    case "revisions":
      // Has revisionOf AND no order changes (that aren't cancelled) AND is not cancelled
      return {
        revisionOf: { not: null },
        orderChanges: { none: {} },
        status: { not: "CANCELLED" },
      };
    case "new-sales":
    default:
      // No revisionOf, no order changes, not cancelled
      return {
        OR: [{ revisionOf: null }, { revisionOf: "" }],
        orderChanges: { none: {} },
        status: { not: "CANCELLED" },
      };
  }
}

// ---------------------------------------------------------------------------
// Status classification — maps ~200 free-form DB values into groups
// ---------------------------------------------------------------------------

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

const SECTION_ORDER = [
  "Ready", "Pending", "On Hold", "Declined",
  "Cancelled", "Other", "Accepted After Decline", "Accepted",
];

// ---------------------------------------------------------------------------
// Status-group filter options
// ---------------------------------------------------------------------------

const groupFilterOptions = [
  { value: "",               label: "Needs Action" },
  { value: "all",            label: "All" },
  { value: "ready",          label: "Ready" },
  { value: "pending",        label: "Pending / On Hold" },
  { value: "declined",       label: "Declined" },
  { value: "cancelled",      label: "Cancelled" },
  { value: "after-decline",  label: "Accepted After Decline" },
  { value: "accepted",       label: "Accepted" },
];

// ---------------------------------------------------------------------------
// Build Prisma WHERE for status group
// ---------------------------------------------------------------------------

function buildGroupWhere(group: string): Record<string, unknown> {
  switch (group) {
    case "all":
      return {};
    case "ready":
      return { depositChargeStatus: "Ready" };
    case "pending":
      return {
        OR: [
          { depositChargeStatus: "Pending" },
          { depositChargeStatus: "pending" },
          { depositChargeStatus: { contains: "hold" } },
        ],
      };
    case "declined":
      return {
        AND: [
          { depositChargeStatus: { contains: "decline" } },
          { NOT: { depositChargeStatus: { contains: "after decline" } } },
        ],
      };
    case "cancelled":
      return { depositChargeStatus: { contains: "cancel" } };
    case "after-decline":
      return { depositChargeStatus: { contains: "after decline" } };
    case "accepted":
      return {
        AND: [
          { depositChargeStatus: { not: null } },
          { NOT: { depositChargeStatus: "Ready" } },
          { NOT: { depositChargeStatus: "Pending" } },
          { NOT: { depositChargeStatus: "pending" } },
          { NOT: { depositChargeStatus: { contains: "hold" } } },
          { NOT: { depositChargeStatus: { contains: "decline" } } },
          { NOT: { depositChargeStatus: { contains: "cancel" } } },
        ],
      };
    default:
      // "needs-action"
      return {
        OR: [
          { depositChargeStatus: "Ready" },
          { depositChargeStatus: "Pending" },
          { depositChargeStatus: "pending" },
          { depositChargeStatus: { contains: "hold" } },
          {
            AND: [
              { depositChargeStatus: { contains: "decline" } },
              { NOT: { depositChargeStatus: { contains: "after decline" } } },
            ],
          },
        ],
      };
  }
}

// ---------------------------------------------------------------------------
// Combine section + group + search into a single WHERE
// ---------------------------------------------------------------------------

function buildWhere(
  section: string,
  group: string,
  search?: string
): Record<string, unknown> {
  const conditions: Record<string, unknown>[] = [
    { depositChargeStatus: { not: null } },
    buildSectionWhere(section),
    buildGroupWhere(group),
  ];

  if (search) {
    conditions.push({
      OR: [
        { orderNumber: { contains: search } },
        { customerName: { contains: search } },
      ],
    });
  }

  return { AND: conditions };
}

// ---------------------------------------------------------------------------
// Serialise Prisma rows → plain JSON for client components
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serialiseOrders(orders: any[]) {
  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    customerEmail: o.customerEmail,
    depositAmount: o.depositAmount.toString(),
    totalPrice: o.totalPrice.toString(),
    depositChargeStatus: o.depositChargeStatus,
    depositNotes: o.depositNotes,
    dateSold: o.dateSold ? o.dateSold.toISOString() : null,
    salesRep: o.salesRep,
  }));
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

const ORDER_INCLUDE = {
  salesRep: { select: { firstName: true, lastName: true } },
} as const;

async function getNeedsActionOrders(section: string, search?: string) {
  const where = buildWhere(section, "needs-action", search);

  const orders = await prisma.order.findMany({
    where,
    include: ORDER_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const grouped: Record<string, ReturnType<typeof serialiseOrders>> = {};
  for (const order of orders) {
    const group = classifyStatus(order.depositChargeStatus);
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(serialiseOrders([order])[0]);
  }

  return { grouped, total: orders.length };
}

async function getFilteredOrders(
  section: string,
  group: string,
  search?: string,
  page = 1
) {
  const where = buildWhere(section, group, search);
  const pageSize = 25;
  const skip = (page - 1) * pageSize;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders: serialiseOrders(orders),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

async function getDepositStats(section: string) {
  // Base condition: depositChargeStatus is not null + section filter
  const base = { AND: [{ depositChargeStatus: { not: null } as unknown }, buildSectionWhere(section)] };

  const [ready, pending, hold, declined, afterDecline, cancelled, allNonNull] =
    await Promise.all([
      prisma.order.count({ where: { ...base, depositChargeStatus: "Ready" } }),
      prisma.order.count({
        where: {
          ...base,
          OR: [
            { depositChargeStatus: "Pending" },
            { depositChargeStatus: "pending" },
          ],
        },
      }),
      prisma.order.count({
        where: { ...base, depositChargeStatus: { contains: "hold" } },
      }),
      prisma.order.count({
        where: {
          AND: [
            ...base.AND,
            { depositChargeStatus: { contains: "decline" } },
            { NOT: { depositChargeStatus: { contains: "after decline" } } },
          ],
        },
      }),
      prisma.order.count({
        where: {
          AND: [...base.AND, { depositChargeStatus: { contains: "after decline" } }],
        },
      }),
      prisma.order.count({
        where: {
          AND: [...base.AND, { depositChargeStatus: { contains: "cancel" } }],
        },
      }),
      prisma.order.count({ where: base }),
    ]);

  const pendingHold = pending + hold;
  const accepted = allNonNull - ready - pending - hold - declined - afterDecline - cancelled;

  return { ready, pendingHold, declined, accepted };
}

async function getSectionCounts() {
  const [newSales, revisions, orderChanges, cancellations] = await Promise.all([
    prisma.order.count({
      where: {
        depositChargeStatus: { not: null },
        ...buildSectionWhere("new-sales"),
      },
    }),
    prisma.order.count({
      where: {
        depositChargeStatus: { not: null },
        ...buildSectionWhere("revisions"),
      },
    }),
    prisma.order.count({
      where: {
        depositChargeStatus: { not: null },
        ...buildSectionWhere("order-changes"),
      },
    }),
    prisma.order.count({
      where: {
        depositChargeStatus: { not: null },
        ...buildSectionWhere("cancellations"),
      },
    }),
  ]);

  return {
    "new-sales": newSales,
    revisions,
    "order-changes": orderChanges,
    cancellations,
  };
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function DepositStatusPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const user = session!.user;

  if (!["Admin", "Manager"].includes(user.roleName)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const activeSection = params.section || "new-sales";
  const activeGroup = params.group || "";
  const isNeedsAction = activeGroup === "";

  const [stats, sectionCounts, data] = await Promise.all([
    getDepositStats(activeSection),
    getSectionCounts(),
    isNeedsAction
      ? getNeedsActionOrders(activeSection, params.search)
      : getFilteredOrders(
          activeSection,
          activeGroup,
          params.search,
          parseInt(params.page || "1", 10)
        ),
  ]);

  const activeGroupLabel =
    groupFilterOptions.find((o) => o.value === activeGroup)?.label || "Needs Action";

  // Build href preserving current search when switching sections
  function sectionHref(sectionKey: string) {
    const p = new URLSearchParams();
    p.set("section", sectionKey);
    if (params.search) p.set("search", params.search);
    if (params.group) p.set("group", params.group);
    return `/deposit-status?${p.toString()}`;
  }

  // Build href preserving current section when switching groups
  function groupHref(groupKey: string) {
    const p = new URLSearchParams();
    if (activeSection !== "new-sales") p.set("section", activeSection);
    if (groupKey) p.set("group", groupKey);
    return `/deposit-status?${p.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Deposit Status</h1>
        <p className="text-muted-foreground">
          Manage deposit charges for orders
        </p>
      </div>

      {/* Section tabs */}
      <div className="flex border-b">
        {SECTIONS.map((s) => (
          <Link
            key={s.key}
            href={sectionHref(s.key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeSection === s.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            )}
          >
            {s.label}
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({sectionCounts[s.key as keyof typeof sectionCounts]})
            </span>
          </Link>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Link href={groupHref("ready")}>
          <Card className={`hover:border-primary/50 transition-colors cursor-pointer ${activeGroup === "ready" ? "border-blue-400" : ""}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ready</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">{stats.ready}</p>
            </CardContent>
          </Card>
        </Link>
        <Link href={groupHref("pending")}>
          <Card className={`hover:border-primary/50 transition-colors cursor-pointer ${activeGroup === "pending" ? "border-amber-400" : ""}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending / On Hold</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-600">{stats.pendingHold}</p>
            </CardContent>
          </Card>
        </Link>
        <Link href={groupHref("declined")}>
          <Card className={`hover:border-primary/50 transition-colors cursor-pointer ${activeGroup === "declined" ? "border-red-400" : ""}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Declined</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{stats.declined}</p>
            </CardContent>
          </Card>
        </Link>
        <Link href={groupHref("accepted")}>
          <Card className={`hover:border-primary/50 transition-colors cursor-pointer ${activeGroup === "accepted" ? "border-green-400" : ""}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Accepted</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{stats.accepted}</p>
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
              <input type="hidden" name="section" value={activeSection} />
              <input
                type="text"
                name="search"
                placeholder="Order # or customer name..."
                defaultValue={params.search}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              />
              <select
                name="group"
                defaultValue={activeGroup}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {groupFilterOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <Button type="submit" size="sm">
                Filter
              </Button>
              {(params.search || params.group) && (
                <Link href={sectionHref(activeSection)}>
                  <Button type="button" variant="outline" size="sm">
                    Clear
                  </Button>
                </Link>
              )}
            </form>
          </div>
        </CardHeader>
      </Card>

      {/* Grouped sections (Needs Action) */}
      {isNeedsAction && "grouped" in data && (
        <GroupedSections
          grouped={data.grouped}
          sectionOrder={SECTION_ORDER}
          total={data.total}
        />
      )}

      {/* Single-group filtered view */}
      {!isNeedsAction && "orders" in data && (
        <FilteredSection
          label={activeGroupLabel}
          orders={data.orders}
          total={data.total}
          page={data.page}
          totalPages={data.totalPages}
          activeGroup={activeGroup}
          activeSection={activeSection}
          search={params.search || ""}
        />
      )}
    </div>
  );
}
