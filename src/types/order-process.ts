/**
 * Types matching the Order Process app's Supabase `orders` table.
 * Order Process is the source of truth for order data.
 * BBD reads from this table for display to customers and CS team.
 */

// ── Raw DB row (snake_case, matches `orders` table columns) ───────────

export interface OPCustomerInfo {
  firstName: string;
  lastName: string;
  deliveryAddress: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
}

export interface OPBuildingInfo {
  manufacturer: string;
  buildingType: string;
  overallWidth: string;
  buildingLength: string;
  baseRailLength: string;
  buildingHeight: string;
  lullLiftRequired: boolean;
  foundationType: string;
  permittingStructure: string;
  drawingType: string;
  customerLandIsReady: boolean;
}

export interface OPPricingInfo {
  subtotalBeforeTax: number;
  extraMoneyFluff: number;
  deposit: number;
}

export interface OPPaymentInfo {
  type: string;
  status: string;
  stripePaymentId?: string;
  stripeCustomerId?: string;
  stripeVerification?: Record<string, unknown>;
  manualApproval?: {
    approved: boolean;
    approvedBy?: string;
    approvedAt?: string;
    notes?: string;
  };
  notes?: string;
}

export interface OPFileInfo {
  name: string;
  storagePath: string;
  downloadUrl: string;
  size: number;
  type: string;
  uploadedAt: string;
}

export interface OPOrderFiles {
  orderFormPdf?: OPFileInfo;
  renderings: OPFileInfo[];
  extraFiles: OPFileInfo[];
  installerFiles: OPFileInfo[];
}

export interface OPLedgerSummary {
  depositRequired: number;
  originalDeposit: number;
  depositAdjustments: number;
  totalReceived: number;
  totalRefunded: number;
  netReceived: number;
  balance: number;
  balanceStatus: "paid" | "underpaid" | "overpaid" | "pending";
  pendingReceived: number;
  pendingRefunds: number;
  entryCount: number;
  lastEntryAt?: string;
  calculatedAt: string;
}

export type OPOrderStatus =
  | "draft"
  | "pending_payment"
  | "sent_for_signature"
  | "signed"
  | "ready_for_manufacturer"
  | "cancelled";

/** Raw row from the Order Process `orders` table */
export interface OPOrderRow {
  id: string;
  order_number: string;
  status: OPOrderStatus;
  customer: OPCustomerInfo;
  building: OPBuildingInfo;
  pricing: OPPricingInfo;
  original_pricing?: OPPricingInfo;
  payment: OPPaymentInfo;
  files: OPOrderFiles;
  sales_person: string;
  order_form_name: string;
  payment_notes: string;
  referred_by: string;
  special_notes: string;
  esign_document_id?: string;
  quote_id?: string;
  validation?: Record<string, unknown>;
  needs_manager_approval: boolean;
  needs_payment_approval: boolean;
  needs_audit: boolean;
  is_test_mode: boolean;
  test_payment_amount?: number;
  ledger_summary?: OPLedgerSummary;
  sent_for_signature_at?: string;
  signed_at?: string;
  paid_at?: string;
  ready_for_manufacturer_at?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  cancelled_by_email?: string;
  cancel_reason?: string;
  previous_status?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  has_change_orders?: boolean;
  active_change_order_id?: string;
  active_change_order_status?: string;
  change_order_count?: number;
  total_deposit_difference?: number;
  additional_deposit_due?: number;
  refund_due?: number;
}

// ── Display-friendly shape consumed by BBD pages ──────────────────────

export interface OrderStageDisplay {
  name: string;
  color: string;
}

/** Order data mapped for BBD display. Used by dashboard, portal, and API routes. */
export interface DisplayOrder {
  id: string;
  orderNumber: string;
  status: OPOrderStatus;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  buildingType: string;
  buildingSize: string;
  buildingHeight: string;
  manufacturer: string;
  foundationType: string;
  deliveryAddress: string;
  deliveryState: string;
  deliveryZip: string;
  totalPrice: number;
  depositAmount: number;
  depositCollected: boolean;
  depositDate: string | null;
  sentToCustomer: boolean;
  sentToCustomerDate: string | null;
  customerSigned: boolean;
  customerSignedDate: string | null;
  sentToManufacturer: boolean;
  sentToManufacturerDate: string | null;
  salesPerson: string;
  specialNotes: string;
  paymentNotes: string;
  referredBy: string;
  cancelReason: string | null;
  cancelledAt: string | null;
  dateSold: string | null;
  createdAt: string;
  updatedAt: string;
  currentStage: OrderStageDisplay;
  files: OPOrderFiles;
  ledgerSummary: OPLedgerSummary | null;
  /** Raw Order Process row for advanced usage */
  _raw: OPOrderRow;
}

// ── Stage mapping ─────────────────────────────────────────────────────

export const OP_STATUS_ORDER: OPOrderStatus[] = [
  "draft",
  "pending_payment",
  "sent_for_signature",
  "signed",
  "ready_for_manufacturer",
  "cancelled",
];

export const OP_STAGE_MAP: Record<OPOrderStatus, OrderStageDisplay> = {
  draft: { name: "Draft", color: "#6B7280" },
  pending_payment: { name: "Pending Payment", color: "#F59E0B" },
  sent_for_signature: { name: "Sent to Customer", color: "#3B82F6" },
  signed: { name: "Signed", color: "#8B5CF6" },
  ready_for_manufacturer: { name: "Sent to Manufacturer", color: "#10B981" },
  cancelled: { name: "Cancelled", color: "#EF4444" },
};
