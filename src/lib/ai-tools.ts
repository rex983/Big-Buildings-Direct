import { prisma } from "./prisma";
import type { FunctionDeclaration } from "@google/generative-ai";
import { SchemaType } from "@google/generative-ai";

const MAX_RESULTS = 50;

// Helper: convert Decimal fields to numbers in an array of records
function decimalsToNumbers<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v !== null && typeof v === "object" && "toNumber" in (v as object)) {
        out[k] = (v as { toNumber(): number }).toNumber();
      } else {
        out[k] = v;
      }
    }
    return out as T;
  });
}

// ─── 1. getOrders ────────────────────────────────────────────────
async function getOrders(params: {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  salesRepName?: string;
  customerName?: string;
  buildingType?: string;
  state?: string;
  installer?: string;
  limit?: number;
}) {
  const where: Record<string, unknown> = {};
  if (params.status) where.status = params.status;
  if (params.buildingType) where.buildingType = { contains: params.buildingType, mode: "insensitive" };
  if (params.state) where.deliveryState = { contains: params.state, mode: "insensitive" };
  if (params.installer) where.installer = { contains: params.installer, mode: "insensitive" };
  if (params.customerName) where.customerName = { contains: params.customerName, mode: "insensitive" };
  if (params.dateFrom || params.dateTo) {
    where.dateSold = {
      ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
      ...(params.dateTo ? { lte: new Date(params.dateTo) } : {}),
    };
  }
  if (params.salesRepName) {
    where.salesRep = {
      OR: [
        { firstName: { contains: params.salesRepName, mode: "insensitive" } },
        { lastName: { contains: params.salesRepName, mode: "insensitive" } },
      ],
    };
  }

  const orders = await prisma.order.findMany({
    where,
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      buildingType: true,
      buildingSize: true,
      deliveryState: true,
      deliveryCity: true,
      totalPrice: true,
      depositAmount: true,
      depositCollected: true,
      status: true,
      priority: true,
      installer: true,
      dateSold: true,
      createdAt: true,
      cancelledAt: true,
      cancelReason: true,
      salesRep: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(params.limit ?? MAX_RESULTS, MAX_RESULTS),
  });

  return decimalsToNumbers(
    orders.map((o) => ({
      ...o,
      salesRepName: o.salesRep ? `${o.salesRep.firstName} ${o.salesRep.lastName}` : null,
      salesRep: undefined,
    }))
  );
}

// ─── 2. getOrderStats ────────────────────────────────────────────
async function getOrderStats(params: {
  groupBy?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
}) {
  const where: Record<string, unknown> = {};
  if (params.status) where.status = params.status;
  if (params.dateFrom || params.dateTo) {
    where.dateSold = {
      ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
      ...(params.dateTo ? { lte: new Date(params.dateTo) } : {}),
    };
  }

  const orders = await prisma.order.findMany({
    where,
    select: {
      status: true,
      totalPrice: true,
      buildingType: true,
      deliveryState: true,
      dateSold: true,
      salesRep: { select: { firstName: true, lastName: true } },
    },
  });

  const groupKey = params.groupBy || "status";
  const groups: Record<string, { count: number; totalRevenue: number }> = {};

  for (const o of orders) {
    let key: string;
    switch (groupKey) {
      case "month":
        key = o.dateSold ? `${o.dateSold.getFullYear()}-${String(o.dateSold.getMonth() + 1).padStart(2, "0")}` : "No Date";
        break;
      case "salesRep":
        key = o.salesRep ? `${o.salesRep.firstName} ${o.salesRep.lastName}` : "Unassigned";
        break;
      case "buildingType":
        key = o.buildingType || "Unknown";
        break;
      case "state":
        key = o.deliveryState || "Unknown";
        break;
      default:
        key = o.status;
    }
    if (!groups[key]) groups[key] = { count: 0, totalRevenue: 0 };
    groups[key].count++;
    groups[key].totalRevenue += o.totalPrice ? Number(o.totalPrice) : 0;
  }

  return Object.entries(groups)
    .map(([group, data]) => ({
      group,
      count: data.count,
      totalRevenue: Math.round(data.totalRevenue * 100) / 100,
    }))
    .sort((a, b) => b.count - a.count);
}

// ─── 3. getTickets ───────────────────────────────────────────────
async function getTickets(params: {
  status?: string;
  type?: string;
  priority?: string;
  assigneeName?: string;
  limit?: number;
}) {
  const where: Record<string, unknown> = {};
  if (params.status) where.status = params.status;
  if (params.type) where.type = params.type;
  if (params.priority) where.priority = params.priority;
  if (params.assigneeName) {
    where.assignedTo = {
      OR: [
        { firstName: { contains: params.assigneeName, mode: "insensitive" } },
        { lastName: { contains: params.assigneeName, mode: "insensitive" } },
      ],
    };
  }

  const tickets = await prisma.ticket.findMany({
    where,
    select: {
      id: true,
      ticketNumber: true,
      subject: true,
      type: true,
      status: true,
      priority: true,
      resolution: true,
      resolvedAt: true,
      createdAt: true,
      order: { select: { orderNumber: true, customerName: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      assignedTo: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(params.limit ?? MAX_RESULTS, MAX_RESULTS),
  });

  return tickets.map((t) => ({
    ...t,
    orderNumber: t.order.orderNumber,
    customerName: t.order.customerName,
    createdByName: `${t.createdBy.firstName} ${t.createdBy.lastName}`,
    assignedToName: t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : null,
    order: undefined,
    createdBy: undefined,
    assignedTo: undefined,
  }));
}

// ─── 6. getUsers ─────────────────────────────────────────────────
async function getUsers(params: {
  role?: string;
  office?: string;
  isActive?: boolean;
  limit?: number;
}) {
  const where: Record<string, unknown> = {};
  if (params.isActive !== undefined) where.isActive = params.isActive;
  if (params.office) where.office = { contains: params.office, mode: "insensitive" };
  if (params.role) where.role = { name: { contains: params.role, mode: "insensitive" } };

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      office: true,
      department: true,
      isActive: true,
      createdAt: true,
      role: { select: { name: true } },
      _count: { select: { salesRepOrders: true } },
    },
    orderBy: { lastName: "asc" },
    take: Math.min(params.limit ?? MAX_RESULTS, MAX_RESULTS),
  });

  return users.map((u) => ({
    id: u.id,
    name: `${u.firstName} ${u.lastName}`,
    email: u.email,
    phone: u.phone,
    office: u.office,
    department: u.department,
    role: u.role.name,
    isActive: u.isActive,
    orderCount: u._count.salesRepOrders,
    createdAt: u.createdAt,
  }));
}

// ─── 7. getPayData ───────────────────────────────────────────────
async function getPayData(params: {
  month?: number;
  year?: number;
  salesRepName?: string;
  limit?: number;
}) {
  const where: Record<string, unknown> = {};
  if (params.month) where.month = params.month;
  if (params.year) where.year = params.year;
  if (params.salesRepName) {
    where.salesRep = {
      OR: [
        { firstName: { contains: params.salesRepName, mode: "insensitive" } },
        { lastName: { contains: params.salesRepName, mode: "insensitive" } },
      ],
    };
  }

  const ledgers = await prisma.payLedger.findMany({
    where,
    select: {
      id: true,
      month: true,
      year: true,
      buildingsSold: true,
      totalOrderAmount: true,
      planTotal: true,
      tierBonusAmount: true,
      monthlySalary: true,
      commissionAmount: true,
      cancellationDeduction: true,
      adjustment: true,
      finalAmount: true,
      status: true,
      salesRep: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    take: Math.min(params.limit ?? MAX_RESULTS, MAX_RESULTS),
  });

  return decimalsToNumbers(
    ledgers.map((l) => ({
      ...l,
      salesRepName: `${l.salesRep.firstName} ${l.salesRep.lastName}`,
      salesRep: undefined,
    }))
  );
}

// ─── 8. getDepositStatus ─────────────────────────────────────────
async function getDepositStatus(params: {
  collected?: boolean;
  chargeStatus?: string;
  limit?: number;
}) {
  const where: Record<string, unknown> = {};
  if (params.collected !== undefined) where.depositCollected = params.collected;
  if (params.chargeStatus) where.depositChargeStatus = { contains: params.chargeStatus, mode: "insensitive" };

  const orders = await prisma.order.findMany({
    where,
    select: {
      orderNumber: true,
      customerName: true,
      totalPrice: true,
      depositAmount: true,
      depositCollected: true,
      depositChargeStatus: true,
      depositDate: true,
      depositPercentage: true,
      depositNotes: true,
      status: true,
      salesRep: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(params.limit ?? MAX_RESULTS, MAX_RESULTS),
  });

  return decimalsToNumbers(
    orders.map((o) => ({
      ...o,
      salesRepName: o.salesRep ? `${o.salesRep.firstName} ${o.salesRep.lastName}` : null,
      salesRep: undefined,
    }))
  );
}

// ─── 9. getCancellations ─────────────────────────────────────────
async function getCancellations(params: {
  dateFrom?: string;
  dateTo?: string;
  salesRepName?: string;
  limit?: number;
}) {
  const where: Record<string, unknown> = { status: "CANCELLED" };
  if (params.dateFrom || params.dateTo) {
    where.cancelledAt = {
      ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
      ...(params.dateTo ? { lte: new Date(params.dateTo) } : {}),
    };
  }
  if (params.salesRepName) {
    where.salesRep = {
      OR: [
        { firstName: { contains: params.salesRepName, mode: "insensitive" } },
        { lastName: { contains: params.salesRepName, mode: "insensitive" } },
      ],
    };
  }

  const orders = await prisma.order.findMany({
    where,
    select: {
      orderNumber: true,
      customerName: true,
      buildingType: true,
      totalPrice: true,
      cancelReason: true,
      cancelledAt: true,
      dateSold: true,
      salesRep: { select: { firstName: true, lastName: true } },
    },
    orderBy: { cancelledAt: "desc" },
    take: Math.min(params.limit ?? MAX_RESULTS, MAX_RESULTS),
  });

  return decimalsToNumbers(
    orders.map((o) => ({
      ...o,
      salesRepName: o.salesRep ? `${o.salesRep.firstName} ${o.salesRep.lastName}` : null,
      salesRep: undefined,
    }))
  );
}

// ─── 10. getCustomers ────────────────────────────────────────────
async function getCustomers(params: {
  name?: string;
  email?: string;
  limit?: number;
}) {
  const where: Record<string, unknown> = {};
  where.role = { name: "Customer" };
  if (params.name) {
    where.OR = [
      { firstName: { contains: params.name, mode: "insensitive" } },
      { lastName: { contains: params.name, mode: "insensitive" } },
    ];
  }
  if (params.email) where.email = { contains: params.email, mode: "insensitive" };

  const customers = await prisma.user.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      isActive: true,
      createdAt: true,
      _count: { select: { customerOrders: true } },
    },
    orderBy: { lastName: "asc" },
    take: Math.min(params.limit ?? MAX_RESULTS, MAX_RESULTS),
  });

  return customers.map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`,
    email: c.email,
    phone: c.phone,
    isActive: c.isActive,
    orderCount: c._count.customerOrders,
    createdAt: c.createdAt,
  }));
}

// ─── Gemini Tool Declarations ────────────────────────────────────

export const aiToolDeclarations: FunctionDeclaration[] = [
  {
    name: "getOrders",
    description: "Search and filter orders by status, date range, sales rep, customer, building type, state, or installer. Returns up to 50 orders with key details.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        status: { type: SchemaType.STRING, description: "Order status: ACTIVE, COMPLETED, CANCELLED, or ON_HOLD" },
        dateFrom: { type: SchemaType.STRING, description: "Start date (ISO format, e.g. 2025-01-01)" },
        dateTo: { type: SchemaType.STRING, description: "End date (ISO format)" },
        salesRepName: { type: SchemaType.STRING, description: "Sales rep first or last name" },
        customerName: { type: SchemaType.STRING, description: "Customer name (partial match)" },
        buildingType: { type: SchemaType.STRING, description: "Building type (partial match)" },
        state: { type: SchemaType.STRING, description: "Delivery state (partial match)" },
        installer: { type: SchemaType.STRING, description: "Installer name (partial match)" },
        limit: { type: SchemaType.NUMBER, description: "Max results (default 50)" },
      },
    },
  },
  {
    name: "getOrderStats",
    description: "Get aggregate order statistics (count and total revenue) grouped by status, month, salesRep, buildingType, or state. Useful for summary/analytics questions.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        groupBy: { type: SchemaType.STRING, description: "Group by: status, month, salesRep, buildingType, or state" },
        dateFrom: { type: SchemaType.STRING, description: "Start date (ISO format)" },
        dateTo: { type: SchemaType.STRING, description: "End date (ISO format)" },
        status: { type: SchemaType.STRING, description: "Filter to specific status before grouping" },
      },
    },
  },
  {
    name: "getTickets",
    description: "Search tickets (BST workflow) by status (OPEN, IN_PROGRESS, PENDING, RESOLVED, CLOSED), type (WELCOME_CALL, LPP, BUILDING_UPDATE, etc.), priority, or assignee.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        status: { type: SchemaType.STRING, description: "Ticket status: OPEN, IN_PROGRESS, PENDING, RESOLVED, CLOSED" },
        type: { type: SchemaType.STRING, description: "Ticket type: WELCOME_CALL, LPP, BUILDING_UPDATE, INFO_UPDATE, MANUFACTURER_CHANGE, OTHER" },
        priority: { type: SchemaType.STRING, description: "Priority: LOW, NORMAL, HIGH, URGENT" },
        assigneeName: { type: SchemaType.STRING, description: "Assignee name (partial match)" },
        limit: { type: SchemaType.NUMBER, description: "Max results (default 50)" },
      },
    },
  },
  {
    name: "getUsers",
    description: "List users/sales reps by role, office, or active status. Never returns passwords.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        role: { type: SchemaType.STRING, description: "Role name (partial match, e.g. 'Sales', 'Admin')" },
        office: { type: SchemaType.STRING, description: "Office name (partial match, e.g. 'Marion', 'Harbor')" },
        isActive: { type: SchemaType.BOOLEAN, description: "Filter by active status" },
        limit: { type: SchemaType.NUMBER, description: "Max results (default 50)" },
      },
    },
  },
  {
    name: "getPayData",
    description: "Get monthly pay ledger data including buildings sold, commissions, bonuses, salary, deductions, and final pay amounts for sales reps.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        month: { type: SchemaType.NUMBER, description: "Month number (1-12)" },
        year: { type: SchemaType.NUMBER, description: "Year (e.g. 2025)" },
        salesRepName: { type: SchemaType.STRING, description: "Sales rep name (partial match)" },
        limit: { type: SchemaType.NUMBER, description: "Max results (default 50)" },
      },
    },
  },
  {
    name: "getDepositStatus",
    description: "Get deposit collection tracking across orders. Filter by collected status or charge status (Ready, Charged, Declined, Refunded, Accepted After Decline).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        collected: { type: SchemaType.BOOLEAN, description: "Filter by deposit collected (true/false)" },
        chargeStatus: { type: SchemaType.STRING, description: "Deposit charge status (partial match)" },
        limit: { type: SchemaType.NUMBER, description: "Max results (default 50)" },
      },
    },
  },
  {
    name: "getCancellations",
    description: "Get cancelled orders with cancel reasons, dates, and sales rep info.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        dateFrom: { type: SchemaType.STRING, description: "Start date (ISO format)" },
        dateTo: { type: SchemaType.STRING, description: "End date (ISO format)" },
        salesRepName: { type: SchemaType.STRING, description: "Sales rep name (partial match)" },
        limit: { type: SchemaType.NUMBER, description: "Max results (default 50)" },
      },
    },
  },
  {
    name: "getCustomers",
    description: "Search customer profiles with order counts.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING, description: "Customer name (partial match)" },
        email: { type: SchemaType.STRING, description: "Customer email (partial match)" },
        limit: { type: SchemaType.NUMBER, description: "Max results (default 50)" },
      },
    },
  },
];

// ─── Dispatcher ──────────────────────────────────────────────────

const toolFunctions: Record<string, (params: Record<string, unknown>) => Promise<unknown>> = {
  getOrders: (p) => getOrders(p as Parameters<typeof getOrders>[0]),
  getOrderStats: (p) => getOrderStats(p as Parameters<typeof getOrderStats>[0]),
  getTickets: (p) => getTickets(p as Parameters<typeof getTickets>[0]),
  getUsers: (p) => getUsers(p as Parameters<typeof getUsers>[0]),
  getPayData: (p) => getPayData(p as Parameters<typeof getPayData>[0]),
  getDepositStatus: (p) => getDepositStatus(p as Parameters<typeof getDepositStatus>[0]),
  getCancellations: (p) => getCancellations(p as Parameters<typeof getCancellations>[0]),
  getCustomers: (p) => getCustomers(p as Parameters<typeof getCustomers>[0]),
};

export async function executeAiTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const fn = toolFunctions[name];
  if (!fn) throw new Error(`Unknown tool: ${name}`);
  return fn(args);
}
