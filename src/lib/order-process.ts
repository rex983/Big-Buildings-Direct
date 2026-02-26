/**
 * Service layer for reading order data from the Order Process app's
 * Supabase `orders` table. This is the single source of truth for orders.
 *
 * BBD uses this service for all order display (dashboard, portal, API routes).
 * BBD-specific features (messages, tickets, etc.) still use Prisma.
 */

import { supabaseAdmin } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import {
  type OPOrderRow,
  type OPOrderStatus,
  type DisplayOrder,
  OP_STAGE_MAP,
  OP_STATUS_ORDER,
} from "@/types/order-process";

// ── Office helpers ──────────────────────────────────────────────────

/**
 * Get all sales person names (firstName + lastName) belonging to a given office.
 * Used by managers to scope their view to their office's reps.
 */
export async function getOfficeSalesPersons(office: string): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { office, isActive: true },
    select: { firstName: true, lastName: true },
  });
  return users.map((u) => `${u.firstName} ${u.lastName}`);
}

// ── Mapping helpers ───────────────────────────────────────────────────

/** Convert a raw Order Process DB row to a BBD display-friendly object. */
function mapToDisplay(row: OPOrderRow): DisplayOrder {
  const statusIndex = OP_STATUS_ORDER.indexOf(row.status);
  const isCancelled = row.status === "cancelled";

  const depositPaid =
    row.payment?.status === "paid" ||
    row.payment?.status === "manually_approved" ||
    !!row.paid_at;

  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    customerName:
      `${row.customer?.firstName || ""} ${row.customer?.lastName || ""}`.trim() ||
      "Unknown",
    customerEmail: row.customer?.email || "",
    customerPhone: row.customer?.phone || "",
    buildingType: row.building?.buildingType || "",
    buildingSize:
      row.building?.overallWidth && row.building?.buildingLength
        ? `${row.building.overallWidth}x${row.building.buildingLength}`
        : "",
    buildingHeight: row.building?.buildingHeight || "",
    manufacturer: row.building?.manufacturer || "",
    foundationType: row.building?.foundationType || "",
    deliveryAddress: row.customer?.deliveryAddress || "",
    deliveryState: row.customer?.state || "",
    deliveryZip: row.customer?.zip || "",
    totalPrice: row.pricing?.subtotalBeforeTax || 0,
    depositAmount: row.pricing?.deposit || 0,
    depositCollected: depositPaid,
    depositDate: row.paid_at || null,
    paymentType: row.payment?.type || "",
    paymentStatus: row.payment?.status || "",
    sentToCustomer: !isCancelled && statusIndex >= 2,
    sentToCustomerDate: row.sent_for_signature_at || null,
    customerSigned: !isCancelled && statusIndex >= 3,
    customerSignedDate: row.signed_at || null,
    sentToManufacturer: !isCancelled && statusIndex >= 4,
    sentToManufacturerDate: row.ready_for_manufacturer_at || null,
    salesPerson: row.sales_person || "",
    specialNotes: row.special_notes || "",
    paymentNotes: row.payment_notes || "",
    referredBy: row.referred_by || "",
    cancelReason: row.cancel_reason || null,
    cancelledAt: row.cancelled_at || null,
    dateSold: row.created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    currentStage: OP_STAGE_MAP[row.status] || OP_STAGE_MAP.draft,
    files: row.files || { renderings: [], extraFiles: [], installerFiles: [] },
    ledgerSummary: row.ledger_summary || null,
    _raw: row,
  };
}

// ── Query functions ───────────────────────────────────────────────────

const TABLE = "orders";

interface OrderListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: OPOrderStatus;
  /** Filter to a single sales person (for individual rep view) */
  salesPerson?: string;
  /** Filter to multiple sales persons (for office-scoped manager view) */
  salesPersons?: string[];
  /** If true, exclude cancelled orders */
  excludeCancelled?: boolean;
  /** Sort field */
  sortBy?: string;
  /** Sort direction */
  sortDir?: "asc" | "desc";
  /** Filter by payment status */
  paymentStatus?: string;
  /** Filter by state */
  state?: string;
  /** Filter by installer/manufacturer */
  installer?: string;
  /** Filter by specific sales rep name (user-chosen filter, separate from scope) */
  salesRepFilter?: string;
}

interface PaginatedOrders {
  orders: DisplayOrder[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Get a paginated list of orders from Order Process. */
export async function getOrders(
  opts: OrderListOptions = {}
): Promise<PaginatedOrders> {
  const page = opts.page || 1;
  const pageSize = opts.pageSize || 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabaseAdmin.from(TABLE).select("*", { count: "exact" });

  if (opts.status) {
    query = query.eq("status", opts.status);
  }
  if (opts.excludeCancelled) {
    query = query.neq("status", "cancelled");
  }
  if (opts.salesPerson) {
    query = query.eq("sales_person", opts.salesPerson);
  } else if (opts.salesPersons && opts.salesPersons.length > 0) {
    query = query.in("sales_person", opts.salesPersons);
  }
  if (opts.search) {
    const term = `%${opts.search}%`;
    query = query.or(
      `order_number.ilike.${term},sales_person.ilike.${term},customer->>email.ilike.${term},customer->>firstName.ilike.${term},customer->>lastName.ilike.${term}`
    );
  }

  // Additional filters
  if (opts.paymentStatus) {
    if (opts.paymentStatus === "paid") {
      query = query.or("payment->>status.eq.paid,payment->>status.eq.manually_approved");
    } else if (opts.paymentStatus === "pending") {
      query = query.eq("payment->>status", "pending");
    } else if (opts.paymentStatus === "unpaid") {
      query = query.or("payment->>status.is.null,payment->>status.eq.unpaid");
    }
  }
  if (opts.state) {
    query = query.ilike("customer->>state", opts.state);
  }
  if (opts.installer) {
    query = query.ilike("building->>manufacturer", opts.installer);
  }
  if (opts.salesRepFilter) {
    query = query.ilike("sales_person", opts.salesRepFilter);
  }

  // Sort
  const sortField = opts.sortBy || "created_at";
  const ascending = opts.sortDir === "asc";

  const sortMap: Record<string, string> = {
    orderNumber: "order_number",
    created_at: "created_at",
    customerName: "customer->>lastName",
    totalPrice: "pricing->>subtotalBeforeTax",
    depositAmount: "pricing->>deposit",
    state: "customer->>state",
    salesPerson: "sales_person",
  };

  query = query.order(sortMap[sortField] || "created_at", { ascending }).range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.error("getOrders error:", JSON.stringify(error, null, 2));
    throw new Error(`Failed to fetch orders: ${error.message} (code: ${error.code}, details: ${error.details})`);
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

/** Get distinct filter values for the orders toolbar. */
export async function getOrderFilterOptions(): Promise<{
  states: string[];
  installers: string[];
  salesReps: string[];
}> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("customer->>state, building->>manufacturer, sales_person");

  if (error) {
    console.error("getOrderFilterOptions error:", error);
    return { states: [], installers: [], salesReps: [] };
  }

  const stateSet = new Set<string>();
  const installerSet = new Set<string>();
  const repSet = new Set<string>();

  for (const row of data || []) {
    const state = (row as Record<string, string>).state;
    const mfr = (row as Record<string, string>).manufacturer;
    const rep = (row as Record<string, string>).sales_person;
    if (state) stateSet.add(state);
    if (mfr) installerSet.add(mfr);
    if (rep) repSet.add(rep);
  }

  return {
    states: [...stateSet].sort(),
    installers: [...installerSet].sort(),
    salesReps: [...repSet].sort(),
  };
}

/** Get a single order by its UUID. */
export async function getOrder(
  orderId: string
): Promise<DisplayOrder | null> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("*")
    .eq("id", orderId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    console.error("getOrder error:", error);
    throw new Error(`Failed to fetch order: ${error.message}`);
  }

  return mapToDisplay(data as OPOrderRow);
}

/** Get orders for a customer by email (for customer portal). */
export async function getOrdersByCustomerEmail(
  email: string,
  limit?: number
): Promise<DisplayOrder[]> {
  let query = supabaseAdmin
    .from(TABLE)
    .select("*")
    .eq("customer->>email", email)
    .order("created_at", { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error("getOrdersByCustomerEmail error:", error);
    throw new Error(`Failed to fetch customer orders: ${error.message}`);
  }

  return ((data || []) as OPOrderRow[]).map(mapToDisplay);
}

// ── Customer aggregation helpers ──────────────────────────────────────

export interface CustomerSummary {
  email: string;
  name: string;
  phone: string;
  orderCount: number;
  totalValue: number;
  sentToMfr: number;
  lastOrderDate: string;
}

/**
 * Build a list of unique customers by aggregating all orders from Supabase.
 * Grouped by lowercase customer email.
 */
export async function getCustomerList(opts?: {
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ customers: CustomerSummary[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const page = opts?.page || 1;
  const pageSize = opts?.pageSize || 20;

  // Fetch all orders with just the fields we need
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("customer, pricing, status, created_at, ready_for_manufacturer_at")
    .neq("status", "draft")
    .eq("is_test_mode", false);

  if (error) {
    console.error("getCustomerList error:", error);
    throw new Error(`Failed to fetch customers: ${error.message}`);
  }

  // Group by lowercase email
  const map = new Map<string, CustomerSummary>();

  for (const row of (data || []) as OPOrderRow[]) {
    const email = (row.customer?.email || "").toLowerCase().trim();
    if (!email) continue;

    const existing = map.get(email);
    const value = row.pricing?.subtotalBeforeTax || 0;
    const isSentToMfr = row.status === "ready_for_manufacturer";
    const date = row.created_at;

    if (existing) {
      existing.orderCount++;
      existing.totalValue += value;
      if (isSentToMfr) existing.sentToMfr++;
      if (date > existing.lastOrderDate) {
        existing.lastOrderDate = date;
        // Update name/phone from the most recent order
        existing.name = `${row.customer?.firstName || ""} ${row.customer?.lastName || ""}`.trim() || existing.name;
        existing.phone = row.customer?.phone || existing.phone;
      }
    } else {
      map.set(email, {
        email,
        name: `${row.customer?.firstName || ""} ${row.customer?.lastName || ""}`.trim() || "Unknown",
        phone: row.customer?.phone || "",
        orderCount: 1,
        totalValue: value,
        sentToMfr: isSentToMfr ? 1 : 0,
        lastOrderDate: date,
      });
    }
  }

  // Convert to array and apply search
  let customers = Array.from(map.values());

  if (opts?.search) {
    const term = opts.search.toLowerCase();
    customers = customers.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        c.phone.includes(term)
    );
  }

  // Sort by most recent order
  customers.sort((a, b) => b.lastOrderDate.localeCompare(a.lastOrderDate));

  const total = customers.length;
  const start = (page - 1) * pageSize;
  const paged = customers.slice(start, start + pageSize);

  return {
    customers: paged,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ── Dashboard aggregation helpers ─────────────────────────────────────

interface OrderStats {
  totalOrders: number;
  sentToManufacturer: number;
  totalDepositsCollected: number;
}

/** Get aggregate stats for orders, optionally filtered by year and sales person. */
export async function getOrderStats(opts: {
  year?: number;
  salesPerson?: string;
  salesPersons?: string[];
}): Promise<OrderStats> {
  // We need to fetch all non-cancelled orders and calculate in JS
  // because Supabase client doesn't support SQL aggregation on JSONB fields.
  let query = supabaseAdmin
    .from(TABLE)
    .select("status, pricing, payment, paid_at, created_at, ready_for_manufacturer_at, sales_person")
    .neq("status", "cancelled");

  if (opts.salesPerson) {
    query = query.eq("sales_person", opts.salesPerson);
  } else if (opts.salesPersons && opts.salesPersons.length > 0) {
    query = query.in("sales_person", opts.salesPersons);
  }

  if (opts.year) {
    const yearStart = `${opts.year}-01-01T00:00:00.000Z`;
    const yearEnd = `${opts.year + 1}-01-01T00:00:00.000Z`;
    query = query.gte("created_at", yearStart).lt("created_at", yearEnd);
  }

  const { data, error } = await query;
  if (error) throw new Error(`getOrderStats error: ${error.message}`);

  const rows = (data || []) as Pick<
    OPOrderRow,
    "status" | "pricing" | "payment" | "paid_at" | "created_at" | "ready_for_manufacturer_at" | "sales_person"
  >[];

  let totalOrders = rows.length;
  let sentToManufacturer = 0;
  let totalDepositsCollected = 0;

  for (const row of rows) {
    if (row.status === "ready_for_manufacturer") {
      sentToManufacturer++;
    }
    const depositPaid =
      row.payment?.status === "paid" ||
      row.payment?.status === "manually_approved" ||
      !!row.paid_at;
    if (depositPaid) {
      totalDepositsCollected += row.pricing?.deposit || 0;
    }
  }

  return { totalOrders, sentToManufacturer, totalDepositsCollected };
}

interface MonthlyData {
  month: string;
  year: number;
  monthNum: number;
  quantity: number;
  totalSales: number;
}

/** Get monthly breakdown of orders for a given year. */
export async function getMonthlyBreakdown(opts: {
  year: number;
  salesPerson?: string;
  salesPersons?: string[];
}): Promise<MonthlyData[]> {
  const yearStart = `${opts.year}-01-01T00:00:00.000Z`;
  const yearEnd = `${opts.year + 1}-01-01T00:00:00.000Z`;

  let query = supabaseAdmin
    .from(TABLE)
    .select("pricing, created_at")
    .neq("status", "cancelled")
    .gte("created_at", yearStart)
    .lt("created_at", yearEnd);

  if (opts.salesPerson) {
    query = query.eq("sales_person", opts.salesPerson);
  } else if (opts.salesPersons && opts.salesPersons.length > 0) {
    query = query.in("sales_person", opts.salesPersons);
  }

  const { data, error } = await query;
  if (error) throw new Error(`getMonthlyBreakdown error: ${error.message}`);

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const months: MonthlyData[] = monthNames.map((name, i) => ({
    month: name,
    year: opts.year,
    monthNum: i,
    quantity: 0,
    totalSales: 0,
  }));

  for (const row of (data || []) as Pick<OPOrderRow, "pricing" | "created_at">[]) {
    const monthIndex = new Date(row.created_at).getMonth();
    months[monthIndex].quantity += 1;
    months[monthIndex].totalSales += row.pricing?.subtotalBeforeTax || 0;
  }

  return months;
}

/** Get orders not yet sent to manufacturer, for dashboard table. */
export async function getOrdersNotSentToManufacturer(opts: {
  year: number;
  salesPerson?: string;
  salesPersons?: string[];
}): Promise<DisplayOrder[]> {
  const yearStart = `${opts.year}-01-01T00:00:00.000Z`;
  const yearEnd = `${opts.year + 1}-01-01T00:00:00.000Z`;

  let query = supabaseAdmin
    .from(TABLE)
    .select("*")
    .neq("status", "cancelled")
    .neq("status", "ready_for_manufacturer")
    .gte("created_at", yearStart)
    .lt("created_at", yearEnd)
    .order("created_at", { ascending: false });

  if (opts.salesPerson) {
    query = query.eq("sales_person", opts.salesPerson);
  } else if (opts.salesPersons && opts.salesPersons.length > 0) {
    query = query.in("sales_person", opts.salesPersons);
  }

  const { data, error } = await query;
  if (error) throw new Error(`getOrdersNotSentToManufacturer error: ${error.message}`);

  return ((data || []) as OPOrderRow[]).map(mapToDisplay);
}

/** Get available years from order data. */
export async function getAvailableYears(): Promise<number[]> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("created_at")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) throw new Error(`getAvailableYears error: ${error.message}`);

  const currentYear = new Date().getFullYear();
  const earliest = data?.[0]?.created_at;
  const startYear = earliest
    ? new Date(earliest).getFullYear()
    : currentYear;

  const years: number[] = [];
  for (let y = currentYear; y >= startYear; y--) {
    years.push(y);
  }
  return years;
}

// ── Map locations (for map page) ──────────────────────────────────────

interface OrderLocation {
  id: string;
  orderNumber: string;
  customerName: string;
  buildingType: string;
  buildingSize: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryZip: string;
  totalPrice: number;
  installer: string;
  dateSold: string | null;
  sentToManufacturer: boolean;
  salesPerson: string;
}

/** Get order locations for the map page. */
export async function getOrderLocations(opts?: {
  salesPerson?: string;
  salesPersons?: string[];
}): Promise<OrderLocation[]> {
  let query = supabaseAdmin
    .from(TABLE)
    .select("*")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(500);

  if (opts?.salesPerson) {
    query = query.eq("sales_person", opts.salesPerson);
  } else if (opts?.salesPersons && opts.salesPersons.length > 0) {
    query = query.in("sales_person", opts.salesPersons);
  }

  const { data, error } = await query;
  if (error) throw new Error(`getOrderLocations error: ${error.message}`);

  return ((data || []) as OPOrderRow[]).map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    customerName:
      `${row.customer?.firstName || ""} ${row.customer?.lastName || ""}`.trim(),
    buildingType: row.building?.buildingType || "",
    buildingSize:
      row.building?.overallWidth && row.building?.buildingLength
        ? `${row.building.overallWidth}x${row.building.buildingLength}`
        : "",
    deliveryAddress: row.customer?.deliveryAddress || "",
    deliveryCity: row.customer?.city || "",
    deliveryState: row.customer?.state || "",
    deliveryZip: row.customer?.zip || "",
    totalPrice: row.pricing?.subtotalBeforeTax || 0,
    installer: row.building?.manufacturer || "",
    dateSold: row.created_at,
    sentToManufacturer: row.status === "ready_for_manufacturer",
    salesPerson: row.sales_person || "",
  }));
}

// ── Write-back to Order Process `orders` table ────────────────────────

/** Update a field on the Order Process `orders` table (for status checkbox toggling). */
export async function updateOrderField(
  orderId: string,
  field: string,
  value: unknown
): Promise<void> {
  // Map BBD field names to Order Process status transitions
  const statusTransitions: Record<string, OPOrderStatus> = {
    sentToCustomer: "sent_for_signature",
    customerSigned: "signed",
    sentToManufacturer: "ready_for_manufacturer",
  };

  // Map for reverting: which status to revert to when unchecking
  const statusReverts: Record<string, OPOrderStatus> = {
    sentToCustomer: "pending_payment",
    customerSigned: "sent_for_signature",
    sentToManufacturer: "signed",
  };

  if (field in statusTransitions && value === true) {
    // Status checkbox toggled ON → advance order status
    const now = new Date().toISOString();
    const dateFields: Record<string, string> = {
      sentToCustomer: "sent_for_signature_at",
      customerSigned: "signed_at",
      sentToManufacturer: "ready_for_manufacturer_at",
    };

    const updateData: Record<string, unknown> = {
      status: statusTransitions[field],
      updated_at: now,
    };

    if (dateFields[field]) {
      updateData[dateFields[field]] = now;
    }

    const { error } = await supabaseAdmin
      .from(TABLE)
      .update(updateData)
      .eq("id", orderId);

    if (error) throw new Error(`updateOrderField error: ${error.message}`);
    return;
  }

  if (field in statusReverts && value === false) {
    // Status checkbox toggled OFF → revert order status to previous stage
    const dateFields: Record<string, string> = {
      sentToCustomer: "sent_for_signature_at",
      customerSigned: "signed_at",
      sentToManufacturer: "ready_for_manufacturer_at",
    };

    const updateData: Record<string, unknown> = {
      status: statusReverts[field],
      updated_at: new Date().toISOString(),
    };

    if (dateFields[field]) {
      updateData[dateFields[field]] = null;
    }

    const { error } = await supabaseAdmin
      .from(TABLE)
      .update(updateData)
      .eq("id", orderId);

    if (error) throw new Error(`updateOrderField error: ${error.message}`);
    return;
  }

  if (field === "depositCollected" && value === true) {
    // Mark deposit as paid
    const { error } = await supabaseAdmin
      .from(TABLE)
      .update({
        payment: { status: "paid" },
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (error) throw new Error(`updateOrderField error: ${error.message}`);
    return;
  }

  if (field === "depositCollected" && value === false) {
    // Revert deposit to pending
    const { error } = await supabaseAdmin
      .from(TABLE)
      .update({
        payment: { status: "pending" },
        paid_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (error) throw new Error(`updateOrderField error: ${error.message}`);
    return;
  }

  // Generic field update (shouldn't normally happen from BBD)
  console.warn(`updateOrderField: unhandled field "${field}" — skipping`);
}
