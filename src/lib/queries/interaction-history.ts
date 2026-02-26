import { supabaseAdmin } from "@/lib/supabase";
import type { DisplayOrder } from "@/types/order-process";

// ── Types ────────────────────────────────────────────────────────────

export type InteractionVariant = "success" | "warning" | "error" | "info" | "default";

export interface InteractionItem {
  id: string;
  type: "esign" | "payment" | "change_order" | "lifecycle";
  timestamp: string;
  title: string;
  description: string;
  status: string;
  statusVariant: InteractionVariant;
  details?: Record<string, string>;
}

// ── Helpers ──────────────────────────────────────────────────────────

function fmt(ts: string | null | undefined): string {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function fmtCurrency(n: number | null | undefined): string {
  if (n == null) return "$0";
  return `$${n.toLocaleString()}`;
}

function esignVariant(status: string): InteractionVariant {
  if (status === "signed") return "success";
  if (status === "sent" || status === "processing") return "info";
  if (status === "cancelled" || status === "error") return "error";
  return "default";
}

function paymentVariant(status: string): InteractionVariant {
  if (status === "paid" || status === "approved" || status === "verified" || status === "manually_approved") return "success";
  if (status === "pending") return "warning";
  if (status === "voided" || status === "failed") return "error";
  return "default";
}

// ── Main fetcher ─────────────────────────────────────────────────────

export async function getInteractionHistory(order: DisplayOrder): Promise<InteractionItem[]> {
  const orderId = order.id;
  const items: InteractionItem[] = [];

  // Fetch esign_documents, payment_ledger, change_orders in parallel
  const [esignRes, ledgerRes, coRes] = await Promise.all([
    supabaseAdmin
      .from("esign_documents")
      .select("*")
      .eq("orderId", orderId)
      .order("createdAt", { ascending: false }),
    supabaseAdmin
      .from("payment_ledger")
      .select("*")
      .eq("orderId", orderId)
      .order("createdAt", { ascending: false }),
    supabaseAdmin
      .from("change_orders")
      .select("*")
      .eq("orderId", orderId)
      .order("createdAt", { ascending: false }),
  ]);

  // ── E-sign documents ───────────────────────────────────────────────
  for (const doc of (esignRes.data || []) as Record<string, any>[]) {
    const status = doc.status || "processing";
    const statusLabel =
      status === "sent" ? "Awaiting Signature" :
      status === "signed" ? "Signed" :
      status === "cancelled" ? "Cancelled" :
      status === "error" ? "Error" : "Processing";

    items.push({
      id: `esign-${doc.id}`,
      type: "esign",
      timestamp: doc.signedAt || doc.cancelledAt || doc.sentAt || doc.createdAt || "",
      title: doc.changeOrderNumber
        ? `Signature: ${doc.changeOrderNumber}`
        : `Signature: ${doc.orderNumber || order.orderNumber}`,
      description: doc.changeOrderNumber
        ? `Change order sent to ${doc.signer?.name || "customer"}`
        : `Order sent to ${doc.signer?.name || "customer"}`,
      status: statusLabel,
      statusVariant: esignVariant(status),
      details: {
        Signer: `${doc.signer?.name || "Unknown"} (${doc.signer?.email || "Unknown"})`,
        ...(doc.sentAt && { Sent: fmt(doc.sentAt) }),
        ...(doc.signedAt && { Signed: fmt(doc.signedAt) }),
        ...(doc.cancelledAt && { Cancelled: fmt(doc.cancelledAt) }),
        ...(doc.cancelledReason && { Reason: doc.cancelledReason }),
      },
    });
  }

  // ── Change orders ──────────────────────────────────────────────────
  for (const co of (coRes.data || []) as Record<string, any>[]) {
    const status = co.status || "draft";
    const statusLabel =
      status === "draft" ? "Draft" :
      status === "pending_signature" ? "Awaiting Signature" :
      status === "signed" ? "Signed" :
      status === "cancelled" ? "Cancelled" : status;
    const variant: InteractionVariant =
      status === "signed" ? "success" :
      status === "cancelled" ? "error" :
      status === "draft" ? "warning" : "info";

    items.push({
      id: `co-${co.id}`,
      type: "change_order",
      timestamp: co.signedAt || co.cancelledAt || co.createdAt || "",
      title: `Change Order: ${co.changeOrderNumber || "Unknown"}`,
      description: co.reason || "No reason provided",
      status: statusLabel,
      statusVariant: variant,
      details: {
        "Total Change": fmtCurrency(co.differences?.totalDiff),
        "Deposit Change": fmtCurrency(co.differences?.depositDiff),
        Created: fmt(co.createdAt),
        ...(co.signedAt && { Signed: fmt(co.signedAt) }),
        ...(co.cancelledAt && { Cancelled: fmt(co.cancelledAt) }),
        ...(co.cancelledReason && { Reason: co.cancelledReason }),
      },
    });
  }

  // ── Order lifecycle events ─────────────────────────────────────────
  const raw = order._raw;

  items.push({
    id: "order-created",
    type: "lifecycle",
    timestamp: raw.created_at,
    title: "Order Created",
    description: `${order.orderNumber} created`,
    status: "Created",
    statusVariant: "default",
    details: {
      "Order Number": order.orderNumber,
      Customer: order.customerName,
      Total: fmtCurrency(order.totalPrice),
      Deposit: fmtCurrency(order.depositAmount),
    },
  });

  if (raw.sent_for_signature_at) {
    items.push({
      id: "order-sent",
      type: "lifecycle",
      timestamp: raw.sent_for_signature_at,
      title: "Order Sent for Signature",
      description: `Sent to ${order.customerEmail}`,
      status: "Sent",
      statusVariant: "info",
      details: {
        "Sent To": order.customerName,
        Email: order.customerEmail,
      },
    });
  }

  if (raw.signed_at) {
    items.push({
      id: "order-signed",
      type: "lifecycle",
      timestamp: raw.signed_at,
      title: "Order Signed",
      description: `Signed by ${order.customerName}`,
      status: "Signed",
      statusVariant: "success",
      details: {
        "Signed By": order.customerName,
      },
    });
  }

  if (raw.ready_for_manufacturer_at) {
    items.push({
      id: "order-ready",
      type: "lifecycle",
      timestamp: raw.ready_for_manufacturer_at,
      title: "Sent to Manufacturer",
      description: "Order sent to manufacturer",
      status: "Complete",
      statusVariant: "success",
    });
  }

  if (raw.cancelled_at) {
    items.push({
      id: "order-cancelled",
      type: "lifecycle",
      timestamp: raw.cancelled_at,
      title: "Order Cancelled",
      description: raw.cancel_reason || "No reason provided",
      status: "Cancelled",
      statusVariant: "error",
      details: {
        ...(raw.cancelled_by_email && { "Cancelled By": raw.cancelled_by_email }),
        ...(raw.cancel_reason && { Reason: raw.cancel_reason }),
      },
    });
  }

  // ── Payment event (from order.payment JSONB) ───────────────────────
  if (raw.payment) {
    const pStatus = raw.payment.status || "pending";
    const pLabel =
      pStatus === "paid" ? "Paid" :
      pStatus === "manually_approved" ? "Approved" :
      pStatus === "pending" ? "Pending" : pStatus;

    items.push({
      id: "payment-main",
      type: "payment",
      timestamp: raw.paid_at || raw.created_at,
      title: `Payment: ${(raw.payment.type || "Unknown").replace(/_/g, " ").toUpperCase()}`,
      description: `Amount: ${fmtCurrency(raw.pricing?.deposit)}`,
      status: pLabel,
      statusVariant: paymentVariant(pStatus),
      details: {
        Type: (raw.payment.type || "Unknown").replace(/_/g, " "),
        Amount: fmtCurrency(raw.pricing?.deposit),
        Status: pLabel,
        ...(raw.payment.stripePaymentId && { "Stripe ID": raw.payment.stripePaymentId }),
        ...(raw.payment.notes && { Notes: raw.payment.notes }),
      },
    });

    if (raw.payment.manualApproval?.approved) {
      items.push({
        id: "payment-approval",
        type: "payment",
        timestamp: raw.payment.manualApproval.approvedAt || raw.created_at,
        title: "Payment Manually Approved",
        description: `Approved by ${raw.payment.manualApproval.approvedBy || "Manager"}`,
        status: "Approved",
        statusVariant: "success",
        details: {
          "Approved By": raw.payment.manualApproval.approvedBy || "Unknown",
          Date: fmt(raw.payment.manualApproval.approvedAt as string | undefined),
          ...(raw.payment.manualApproval.notes && { Notes: raw.payment.manualApproval.notes }),
        },
      });
    }
  }

  // ── Payment ledger entries ─────────────────────────────────────────
  for (const record of (ledgerRes.data || []) as Record<string, any>[]) {
    if (record.status === "voided") continue;
    const sLabel =
      record.status === "approved" || record.status === "verified" ? "Paid" :
      record.status === "pending" ? "Pending" : record.status || "Unknown";
    const typeLabel = record.transactionType === "refund" ? "Refund" : "Payment";

    items.push({
      id: `ledger-${record.id}`,
      type: "payment",
      timestamp: record.createdAt || "",
      title: `${typeLabel}: ${(record.category || "PAYMENT").replace(/_/g, " ").toUpperCase()}`,
      description: `Amount: ${fmtCurrency(record.amount)}${record.paymentNumber ? ` (${record.paymentNumber})` : ""}`,
      status: sLabel,
      statusVariant: paymentVariant(record.status),
      details: {
        Amount: fmtCurrency(record.amount),
        Method: (record.method || "Unknown").replace(/_/g, " "),
        Type: record.transactionType || "payment",
        Status: sLabel,
        ...(record.paymentNumber && { "Payment #": record.paymentNumber }),
        ...(record.stripePaymentId && { "Stripe ID": record.stripePaymentId }),
        ...(record.approvedBy && { "Approved By": record.approvedBy }),
        ...(record.description && { Description: record.description }),
      },
    });
  }

  // ── Sort by timestamp descending ───────────────────────────────────
  items.sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return tb - ta;
  });

  return items;
}
