import { prisma } from "@/lib/prisma";
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

export interface RevisionSearchParams {
  rpage?: string;
  rsearch?: string;
  rchangeType?: string;
}

export interface CancellationSearchParams {
  cpage?: string;
  csearch?: string;
}

export interface TabCounts {
  pipeline: number;
  tickets: number;
  revisions: number;
  cancellations: number;
}

// ============ Helpers ============

export function buildBstStageFilter(bstStage?: string) {
  switch (bstStage) {
    case "stmPending":
      return { wcStatus: null };
    case "wcPending":
      return { wcStatus: "Pending" };
    case "noContactMade":
      return { wcStatus: "No Contact Made" };
    case "wcDoneLpp":
      return {
        wcStatus: "Contact Made",
        OR: [{ lppStatus: null }, { lppStatus: "Pending" }],
      };
    case "readyToInstall":
      return {
        wcStatus: "Contact Made",
        lppStatus: "Ready for Install",
      };
    default:
      return {};
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
  const skip = (page - 1) * pageSize;

  const searchFilter = params.search
    ? {
        OR: [
          { orderNumber: { contains: params.search } },
          { customerName: { contains: params.search } },
          { customerEmail: { contains: params.search } },
          { installer: { contains: params.search } },
        ],
      }
    : {};

  const bstStageFilter = buildBstStageFilter(params.bstStage);

  let where: Record<string, unknown>;
  if ("OR" in bstStageFilter) {
    const { OR, ...rest } = bstStageFilter;
    where = {
      sentToManufacturer: true,
      status: { not: "CANCELLED" },
      ...searchFilter,
      ...rest,
      OR,
    };
  } else {
    where = {
      sentToManufacturer: true,
      status: { not: "CANCELLED" },
      ...searchFilter,
      ...bstStageFilter,
    };
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        currentStage: true,
        salesRep: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { sentToManufacturerDate: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getBstStageCounts(): Promise<BstStageCounts> {
  const baseWhere = {
    sentToManufacturer: true,
    status: { not: "CANCELLED" },
  };

  const [stmPending, wcPending, noContactMade, wcDoneLpp, readyToInstall] =
    await Promise.all([
      prisma.order.count({ where: { ...baseWhere, wcStatus: null } }),
      prisma.order.count({ where: { ...baseWhere, wcStatus: "Pending" } }),
      prisma.order.count({ where: { ...baseWhere, wcStatus: "No Contact Made" } }),
      prisma.order.count({
        where: {
          ...baseWhere,
          wcStatus: "Contact Made",
          OR: [{ lppStatus: null }, { lppStatus: "Pending" }],
        },
      }),
      prisma.order.count({
        where: {
          ...baseWhere,
          wcStatus: "Contact Made",
          lppStatus: "Ready for Install",
        },
      }),
    ]);

  return { stmPending, wcPending, noContactMade, wcDoneLpp, readyToInstall };
}

export async function getWcStageOrders() {
  const baseWhere = {
    sentToManufacturer: true,
    status: { not: "CANCELLED" as const },
  };

  const orderSelect = {
    id: true,
    orderNumber: true,
    customerName: true,
    customerEmail: true,
    customerPhone: true,
    buildingType: true,
    buildingSize: true,
    installer: true,
    wcStatus: true,
    lppStatus: true,
    sentToManufacturerDate: true,
    salesRep: { select: { firstName: true, lastName: true } },
  };

  const [stmPendingOrders, wcPendingOrders, noContactMadeOrders] = await Promise.all([
    prisma.order.findMany({
      where: { ...baseWhere, wcStatus: null },
      select: orderSelect,
      orderBy: { sentToManufacturerDate: "desc" },
      take: 100,
    }),
    prisma.order.findMany({
      where: { ...baseWhere, wcStatus: "Pending" },
      select: orderSelect,
      orderBy: { sentToManufacturerDate: "desc" },
      take: 100,
    }),
    prisma.order.findMany({
      where: { ...baseWhere, wcStatus: "No Contact Made" },
      select: orderSelect,
      orderBy: { sentToManufacturerDate: "desc" },
      take: 100,
    }),
  ]);

  return { stmPendingOrders, wcPendingOrders, noContactMadeOrders };
}

// ============ Tickets Queries ============

// Sort order maps for status and priority
const statusOrder: Record<string, number> = {
  OPEN: 0,
  IN_PROGRESS: 1,
  PENDING: 2,
  RESOLVED: 3,
  CLOSED: 4,
};

const priorityOrder: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

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

  // Fetch all matching tickets so we can sort by status then priority in JS
  // (Prisma/SQLite can't custom-order string enum fields)
  const [allTickets, total] = await Promise.all([
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
    }),
    prisma.ticket.count({ where }),
  ]);

  // Sort: status (OPEN first) → priority (URGENT first) → createdAt (newest first)
  allTickets.sort((a, b) => {
    const statusA = statusOrder[a.status] ?? 99;
    const statusB = statusOrder[b.status] ?? 99;
    if (statusA !== statusB) return statusA - statusB;

    const prioA = priorityOrder[a.priority] ?? 99;
    const prioB = priorityOrder[b.priority] ?? 99;
    if (prioA !== prioB) return prioA - prioB;

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Manual pagination
  const skip = (page - 1) * pageSize;
  const tickets = allTickets.slice(skip, skip + pageSize);

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

// ============ Revisions Queries (BST-scoped) ============

export async function getRevisionsForBst(params: RevisionSearchParams) {
  const page = parseInt(params.rpage || "1", 10);
  const pageSize = 20;
  const skip = (page - 1) * pageSize;

  const searchFilter = params.rsearch
    ? {
        OR: [
          { order: { orderNumber: { contains: params.rsearch } } },
          { order: { customerName: { contains: params.rsearch } } },
          { revisionNotes: { contains: params.rsearch } },
        ],
      }
    : {};

  const changeTypeFilter = params.rchangeType
    ? { changeInPrice: params.rchangeType }
    : {};

  const where = {
    order: { sentToManufacturer: true },
    ...searchFilter,
    ...changeTypeFilter,
  };

  const [revisions, total] = await Promise.all([
    prisma.revision.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            customerEmail: true,
          },
        },
        salesRep: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { revisionDate: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.revision.count({ where }),
  ]);

  return {
    revisions,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getRevisionStats() {
  const bstScope = { order: { sentToManufacturer: true } };

  const [total, withPriceChange, withManufacturerChange] = await Promise.all([
    prisma.revision.count({ where: bstScope }),
    prisma.revision.count({
      where: { ...bstScope, changeInPrice: "Change In Deposit Total" },
    }),
    prisma.revision.count({
      where: { ...bstScope, changingManufacturer: true },
    }),
  ]);

  return { total, withPriceChange, withManufacturerChange };
}

// ============ Cancellations Queries ============

export async function getCancelledOrders(params: CancellationSearchParams) {
  const page = parseInt(params.cpage || "1", 10);
  const pageSize = 20;
  const skip = (page - 1) * pageSize;

  const searchFilter = params.csearch
    ? {
        OR: [
          { orderNumber: { contains: params.csearch } },
          { customerName: { contains: params.csearch } },
          { installer: { contains: params.csearch } },
          { cancelReason: { contains: params.csearch } },
        ],
      }
    : {};

  const where = {
    status: "CANCELLED",
    ...searchFilter,
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        salesRep: { select: { firstName: true, lastName: true } },
      },
      orderBy: { cancelledAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getCancellationStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const [total, thisMonth, thisWeek] = await Promise.all([
    prisma.order.count({ where: { status: "CANCELLED" } }),
    prisma.order.count({
      where: { status: "CANCELLED", cancelledAt: { gte: startOfMonth } },
    }),
    prisma.order.count({
      where: { status: "CANCELLED", cancelledAt: { gte: startOfWeek } },
    }),
  ]);

  return { total, thisMonth, thisWeek };
}

// ============ Tab Counts (lightweight) ============

export async function getTabCounts(userId: string): Promise<TabCounts> {
  const [pipeline, tickets, revisions, cancellations] = await Promise.all([
    prisma.order.count({
      where: { sentToManufacturer: true, status: { not: "CANCELLED" } },
    }),
    prisma.ticket.count({
      where: { status: { notIn: ["RESOLVED", "CLOSED"] } },
    }),
    prisma.revision.count({
      where: { order: { sentToManufacturer: true } },
    }),
    prisma.order.count({
      where: { status: "CANCELLED" },
    }),
  ]);

  return { pipeline, tickets, revisions, cancellations };
}
