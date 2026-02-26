import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { mapToDisplay } from "@/lib/order-process";
import type { OPOrderRow } from "@/types/order-process";
import type { DisplayOrder } from "@/types/order-process";
import type { BstStageCounts } from "@/components/features/orders/bst-pipeline-cards";

// ============ Constants ============

export const wcStatusOptions = [
  { value: "Pending", label: "Pending", color: "gray" },
  { value: "No Contact Made", label: "No Contact Made", color: "orange" },
  { value: "Contact Made", label: "Contact Made", color: "green" },
];

export const lppStatusOptions = [
  { value: "Pending", label: "Pending", color: "gray" },
  { value: "Ready for Install", label: "Ready for Install", color: "green" },
];

export const ticketStatuses = [
  { value: "", label: "All Statuses" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "PENDING", label: "Pending" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

export const ticketTypes = [
  { value: "", label: "All Types" },
  { value: "WELCOME_CALL", label: "Welcome Call" },
  { value: "LPP", label: "LP&P" },
  { value: "BUILDING_UPDATE", label: "Building Update" },
  { value: "INFO_UPDATE", label: "Info Update" },
  { value: "MANUFACTURER_CHANGE", label: "Mfr Change" },
  { value: "OTHER", label: "Other" },
];

// ============ Interfaces ============

export interface PipelineSearchParams {
  page?: string;
  search?: string;
  bstStage?: string;
}

export interface TicketSearchParams {
  tpage?: string;
  tsearch?: string;
  tstatus?: string;
  ttype?: string;
  tpriority?: string;
  assignedToMe?: string;
}

export interface CancellationSearchParams {
  cpage?: string;
  csearch?: string;
}

export interface TabCounts {
  pipeline: number;
  tickets: number;
  cancellations: number;
}

// ============ Helpers ============

const TABLE = "orders";

/**
 * Apply BST stage filter to a Supabase query builder.
 * Returns the query with the appropriate wc_status / lpp_status filters chained.
 */
function applyBstStageFilter<T extends { eq: Function; is: Function; or: Function }>(
  query: T,
  bstStage?: string,
): T {
  switch (bstStage) {
    case "stmPending":
      return query.is("wc_status", null) as T;
    case "wcPending":
      return query.eq("wc_status", "Pending") as T;
    case "noContactMade":
      return query.eq("wc_status", "No Contact Made") as T;
    case "wcDoneLpp":
      return query
        .eq("wc_status", "Contact Made")
        .or("lpp_status.is.null,lpp_status.eq.Pending") as T;
    case "readyToInstall":
      return query
        .eq("wc_status", "Contact Made")
        .eq("lpp_status", "Ready for Install") as T;
    default:
      return query;
  }
}

export function getBstStageLabel(wcStatus: string | null, lppStatus: string | null): string {
  if (wcStatus === null) return "STM Pending";
  if (wcStatus === "Pending") return "WC Pending";
  if (wcStatus === "No Contact Made") return "No Contact";
  if (wcStatus === "Contact Made") {
    if (lppStatus === "Ready for Install") return "Ready";
    return "LP&P";
  }
  return "-";
}

// ============ Pipeline Queries ============

export async function getManufacturerOrders(params: PipelineSearchParams) {
  const page = parseInt(params.page || "1", 10);
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabaseAdmin
    .from(TABLE)
    .select("*", { count: "exact" })
    .eq("status", "ready_for_manufacturer");

  // Apply BST stage filter
  query = applyBstStageFilter(query, params.bstStage);

  // Search
  if (params.search) {
    const term = `%${params.search}%`;
    query = query.or(
      `order_number.ilike.${term},sales_person.ilike.${term},customer->>email.ilike.${term},customer->>firstName.ilike.${term},customer->>lastName.ilike.${term},building->>manufacturer.ilike.${term}`
    );
  }

  query = query.order("ready_for_manufacturer_at", { ascending: false }).range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.error("getManufacturerOrders error:", error);
    throw new Error(`Failed to fetch manufacturer orders: ${error.message}`);
  }

  const rows = (data || []) as OPOrderRow[];
  const total = count || 0;

  return {
    orders: rows.map(mapToDisplay),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getBstStageCounts(): Promise<BstStageCounts> {
  const baseFilter = () =>
    supabaseAdmin
      .from(TABLE)
      .select("*", { count: "exact", head: true })
      .eq("status", "ready_for_manufacturer");

  const [stmPending, wcPending, noContactMade, wcDoneLpp, readyToInstall] =
    await Promise.all([
      // Stage 1: wc_status IS NULL
      baseFilter().is("wc_status", null),
      // Stage 2: wc_status = 'Pending'
      baseFilter().eq("wc_status", "Pending"),
      // Stage 3: wc_status = 'No Contact Made'
      baseFilter().eq("wc_status", "No Contact Made"),
      // Stage 4: wc_status = 'Contact Made', lpp_status IS NULL or 'Pending'
      baseFilter()
        .eq("wc_status", "Contact Made")
        .or("lpp_status.is.null,lpp_status.eq.Pending"),
      // Stage 5: wc_status = 'Contact Made', lpp_status = 'Ready for Install'
      baseFilter()
        .eq("wc_status", "Contact Made")
        .eq("lpp_status", "Ready for Install"),
    ]);

  return {
    stmPending: stmPending.count ?? 0,
    wcPending: wcPending.count ?? 0,
    noContactMade: noContactMade.count ?? 0,
    wcDoneLpp: wcDoneLpp.count ?? 0,
    readyToInstall: readyToInstall.count ?? 0,
  };
}

export async function getWcStageOrders() {
  const baseQuery = () =>
    supabaseAdmin
      .from(TABLE)
      .select("*")
      .eq("status", "ready_for_manufacturer")
      .order("ready_for_manufacturer_at", { ascending: false })
      .limit(100);

  const [stmRes, wcRes, ncRes] = await Promise.all([
    baseQuery().is("wc_status", null),
    baseQuery().eq("wc_status", "Pending"),
    baseQuery().eq("wc_status", "No Contact Made"),
  ]);

  if (stmRes.error) throw new Error(`getWcStageOrders stm error: ${stmRes.error.message}`);
  if (wcRes.error) throw new Error(`getWcStageOrders wc error: ${wcRes.error.message}`);
  if (ncRes.error) throw new Error(`getWcStageOrders nc error: ${ncRes.error.message}`);

  return {
    stmPendingOrders: ((stmRes.data || []) as OPOrderRow[]).map(mapToDisplay),
    wcPendingOrders: ((wcRes.data || []) as OPOrderRow[]).map(mapToDisplay),
    noContactMadeOrders: ((ncRes.data || []) as OPOrderRow[]).map(mapToDisplay),
  };
}

// ============ Tickets Queries ============

export async function getTickets(params: TicketSearchParams, userId: string) {
  const page = parseInt(params.tpage || "1", 10);
  const pageSize = 20;

  const where: Record<string, unknown> = {};

  if (params.tstatus) {
    where.status = params.tstatus;
  }
  if (params.ttype) {
    where.type = params.ttype;
  }
  if (params.tpriority) {
    where.priority = params.tpriority;
  }
  if (params.assignedToMe === "true") {
    where.assignedToId = userId;
  }
  if (params.tsearch) {
    where.OR = [
      { ticketNumber: { contains: params.tsearch } },
      { subject: { contains: params.tsearch } },
      { order: { orderNumber: { contains: params.tsearch } } },
      { order: { customerName: { contains: params.tsearch } } },
    ];
  }

  const skip = (page - 1) * pageSize;

  const ticketInclude = {
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
  };

  // When filtering by specific status, we can paginate at DB level
  // since the primary sort key is already constrained
  const hasStatusFilter = !!params.tstatus;

  const [tickets, total] = await Promise.all([
    hasStatusFilter
      ? prisma.ticket.findMany({
          where,
          include: ticketInclude,
          orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
          skip,
          take: pageSize,
        })
      : // Without status filter, fetch open/active tickets first via two queries
        // to avoid loading entire table
        (async () => {
          // Fetch active tickets (OPEN, IN_PROGRESS, PENDING) with DB pagination
          const activeWhere = { ...where, status: { in: ["OPEN", "IN_PROGRESS", "PENDING"] } };
          const activeCount = await prisma.ticket.count({ where: activeWhere });

          if (skip < activeCount) {
            // Current page falls within active tickets
            const activeTickets = await prisma.ticket.findMany({
              where: activeWhere,
              include: ticketInclude,
              orderBy: [{ createdAt: "desc" }],
              skip,
              take: pageSize,
            });
            if (activeTickets.length >= pageSize) return activeTickets;

            // Need to fill remaining from resolved/closed
            const remaining = pageSize - activeTickets.length;
            const closedTickets = await prisma.ticket.findMany({
              where: { ...where, status: { in: ["RESOLVED", "CLOSED"] } },
              include: ticketInclude,
              orderBy: [{ createdAt: "desc" }],
              take: remaining,
            });
            return [...activeTickets, ...closedTickets];
          } else {
            // Current page is past active tickets, only show resolved/closed
            const closedSkip = skip - activeCount;
            return prisma.ticket.findMany({
              where: { ...where, status: { in: ["RESOLVED", "CLOSED"] } },
              include: ticketInclude,
              orderBy: [{ createdAt: "desc" }],
              skip: closedSkip,
              take: pageSize,
            });
          }
        })(),
    prisma.ticket.count({ where }),
  ]);

  return {
    tickets,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getTicketStats(userId: string) {
  const [open, inProgress, pending, assignedToMe] = await Promise.all([
    prisma.ticket.count({ where: { status: "OPEN" } }),
    prisma.ticket.count({ where: { status: "IN_PROGRESS" } }),
    prisma.ticket.count({ where: { status: "PENDING" } }),
    prisma.ticket.count({ where: { assignedToId: userId, status: { not: "CLOSED" } } }),
  ]);

  return { open, inProgress, pending, assignedToMe };
}

// ============ Cancellations Queries ============

export async function getCancelledOrders(params: CancellationSearchParams) {
  const page = parseInt(params.cpage || "1", 10);
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabaseAdmin
    .from(TABLE)
    .select("*", { count: "exact" })
    .eq("status", "cancelled");

  if (params.csearch) {
    const term = `%${params.csearch}%`;
    query = query.or(
      `order_number.ilike.${term},sales_person.ilike.${term},customer->>firstName.ilike.${term},customer->>lastName.ilike.${term},building->>manufacturer.ilike.${term},cancel_reason.ilike.${term}`
    );
  }

  query = query.order("cancelled_at", { ascending: false, nullsFirst: false }).range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.error("getCancelledOrders error:", error);
    throw new Error(`Failed to fetch cancelled orders: ${error.message}`);
  }

  const rows = (data || []) as OPOrderRow[];
  const total = count || 0;

  return {
    orders: rows.map(mapToDisplay),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getCancellationStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfWeekISO = startOfWeek.toISOString();

  const [totalRes, thisMonthRes, thisWeekRes] = await Promise.all([
    supabaseAdmin
      .from(TABLE)
      .select("*", { count: "exact", head: true })
      .eq("status", "cancelled"),
    supabaseAdmin
      .from(TABLE)
      .select("*", { count: "exact", head: true })
      .eq("status", "cancelled")
      .gte("cancelled_at", startOfMonth),
    supabaseAdmin
      .from(TABLE)
      .select("*", { count: "exact", head: true })
      .eq("status", "cancelled")
      .gte("cancelled_at", startOfWeekISO),
  ]);

  return {
    total: totalRes.count ?? 0,
    thisMonth: thisMonthRes.count ?? 0,
    thisWeek: thisWeekRes.count ?? 0,
  };
}

// ============ Tab Counts (lightweight) ============

export async function getTabCounts(userId: string): Promise<TabCounts> {
  const [pipelineRes, tickets, cancellationsRes] = await Promise.all([
    supabaseAdmin
      .from(TABLE)
      .select("*", { count: "exact", head: true })
      .eq("status", "ready_for_manufacturer"),
    prisma.ticket.count({
      where: { status: { notIn: ["RESOLVED", "CLOSED"] } },
    }),
    supabaseAdmin
      .from(TABLE)
      .select("*", { count: "exact", head: true })
      .eq("status", "cancelled"),
  ]);

  return {
    pipeline: pipelineRes.count ?? 0,
    tickets,
    cancellations: cancellationsRes.count ?? 0,
  };
}
