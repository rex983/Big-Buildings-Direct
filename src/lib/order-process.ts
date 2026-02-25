/**
 * Service layer for reading order data from the Order Process app's
 * Supabase `orders` table. This is the single source of truth for orders.
 *
 * BBD uses this service for all order display (dashboard, portal, API routes).
 * BBD-specific features (messages, tickets, etc.) still use Prisma.
 */

import { supabaseAdmin } from "@/lib/supabase";
import {
  type OPOrderRow,
  type OPOrderStatus,
  type DisplayOrder,
  OP_STAGE_MAP,
  OP_STATUS_ORDER,
} from "@/types/order-process";

// ── Mapping helpers ───────────────────────────────────────────────────

/** Convert a raw Order Process DB row to a BBD display-friendly object. */
export function mapToDisplay(row: OPOrderRow): DisplayOrder {
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

export interface OrderListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: OPOrderStatus;
  salesPerson?: string;
  /** If true, exclude cancelled orders */
  excludeCancelled?: boolean;
}

export interface PaginatedOrders {
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
  }
  if (opts.search) {
    const term = `%${opts.search}%`;
    query = query.or(
      `order_number.ilike.${term},sales_person.ilike.${term},customer->>email.ilike.${term},customer->>firstName.ilike.${term},customer->>lastName.ilike.${term}`
    );
  }

  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.error("getOrders error:", error);
    throw new Error(`Failed to fetch orders: ${error.message}`);
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

/** Get a single order by order number. */
export async function getOrderByNumber(
  orderNumber: string
): Promise<DisplayOrder | null> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("*")
    .eq("order_number", orderNumber)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("getOrderByNumber error:", error);
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

// ── Dashboard aggregation helpers ─────────────────────────────────────

export interface OrderStats {
  totalOrders: number;
  sentToManufacturer: number;
  totalDepositsCollected: number;
}

/** Get aggregate stats for orders, optionally filtered by year and sales person. */
export async function getOrderStats(opts: {
  year?: number;
  salesPerson?: string;
}): Promise<OrderStats> {
  // We need to fetch all non-cancelled orders and calculate in JS
  // because Supabase client doesn't support SQL aggregation on JSONB fields.
  let query = supabaseAdmin
    .from(TABLE)
    .select("status, pricing, payment, paid_at, created_at, ready_for_manufacturer_at, sales_person")
    .neq("status", "cancelled");

  if (opts.salesPerson) {
    query = query.eq("sales_person", opts.salesPerson);
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

export interface MonthlyData {
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

export interface OrderLocation {
  id: string;
  orderNumber: string;
  customerName: string;
  buildingType: string;
  buildingSize: string;
  deliveryAddress: string;
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
}): Promise<OrderLocation[]> {
  let query = supabaseAdmin
    .from(TABLE)
    .select("*")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(500);

  if (opts?.salesPerson) {
    query = query.eq("sales_person", opts.salesPerson);
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

  if (field in statusTransitions && value === true) {
    // Status checkbox toggled ON → advance order status
    const { error } = await supabaseAdmin
      .from(TABLE)
      .update({
        status: statusTransitions[field],
        updated_at: new Date().toISOString(),
      })
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

  // Generic field update (shouldn't normally happen from BBD)
  console.warn(`updateOrderField: unhandled field "${field}" — skipping`);
}
