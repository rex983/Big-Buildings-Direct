import type {
  User,
  Role,
  Permission,
  Order,
  OrderStage,
  OrderActivity,
  File,
  Document,
  Message,
  Email,
} from "@prisma/client";

// Re-export Prisma types
export type {
  User,
  Role,
  Permission,
  Order,
  OrderStage,
  OrderActivity,
  File,
  Document,
  Message,
  Email,
};

// Enum-like constants (SQLite compatible)
export const OrderStatus = {
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  ON_HOLD: "ON_HOLD",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const OrderPriority = {
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  URGENT: "URGENT",
} as const;
export type OrderPriority = (typeof OrderPriority)[keyof typeof OrderPriority];

export const ActivityType = {
  ORDER_CREATED: "ORDER_CREATED",
  ORDER_UPDATED: "ORDER_UPDATED",
  STAGE_CHANGED: "STAGE_CHANGED",
  FILE_UPLOADED: "FILE_UPLOADED",
  FILE_DELETED: "FILE_DELETED",
  DOCUMENT_SENT: "DOCUMENT_SENT",
  DOCUMENT_SIGNED: "DOCUMENT_SIGNED",
  MESSAGE_SENT: "MESSAGE_SENT",
  EMAIL_SENT: "EMAIL_SENT",
  EMAIL_RECEIVED: "EMAIL_RECEIVED",
  NOTE_ADDED: "NOTE_ADDED",
  STATUS_CHANGED: "STATUS_CHANGED",
  BST_STATUS_CHANGED: "BST_STATUS_CHANGED",
  DEPOSIT_STATUS_CHANGED: "DEPOSIT_STATUS_CHANGED",
  ESIGN_SENT: "ESIGN_SENT",
  ESIGN_SIGNED: "ESIGN_SIGNED",
  ESIGN_DEPOSIT_COLLECTED: "ESIGN_DEPOSIT_COLLECTED",
} as const;
export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType];

export const DepositChargeStatus = {
  READY: "Ready",
  CHARGED: "Charged",
  DECLINED: "Declined",
  REFUNDED: "Refunded",
  ACCEPTED_AFTER_DECLINE: "Accepted After Decline",
} as const;
export type DepositChargeStatus = (typeof DepositChargeStatus)[keyof typeof DepositChargeStatus];

export const FileCategory = {
  CONTRACT: "CONTRACT",
  INVOICE: "INVOICE",
  BLUEPRINT: "BLUEPRINT",
  PHOTO: "PHOTO",
  PERMIT: "PERMIT",
  OTHER: "OTHER",
} as const;
export type FileCategory = (typeof FileCategory)[keyof typeof FileCategory];

export const DocumentStatus = {
  DRAFT: "DRAFT",
  SENT: "SENT",
  VIEWED: "VIEWED",
  SIGNED: "SIGNED",
  EXPIRED: "EXPIRED",
} as const;
export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

export const EmailStatus = {
  QUEUED: "QUEUED",
  SENT: "SENT",
  DELIVERED: "DELIVERED",
  OPENED: "OPENED",
  FAILED: "FAILED",
  BOUNCED: "BOUNCED",
} as const;
export type EmailStatus = (typeof EmailStatus)[keyof typeof EmailStatus];

export const EmailDirection = {
  INBOUND: "INBOUND",
  OUTBOUND: "OUTBOUND",
} as const;
export type EmailDirection = (typeof EmailDirection)[keyof typeof EmailDirection];

// Extended types with relations
export type UserWithRole = User & {
  role: Role & {
    permissions: { permission: Permission }[];
  };
};

export type OrderWithRelations = Order & {
  customer?: User | null;
  salesRep?: User | null;
  currentStage?: OrderStage | null;
};

export type OrderWithFullRelations = Order & {
  customer?: User | null;
  salesRep?: User | null;
  currentStage?: OrderStage | null;
  stageHistory: (OrderStageHistory & { stage: OrderStage })[];
  activities: OrderActivity[];
  files: { file: File }[];
  documents: Document[];
  messages: Message[];
};

export type OrderStageHistory = {
  id: string;
  notes: string | null;
  createdAt: Date;
  orderId: string;
  stageId: string;
  changedById: string | null;
  stage: OrderStage;
};

export type MessageWithSender = Message & {
  sender: Pick<User, "id" | "firstName" | "lastName" | "avatar">;
};

export type DocumentWithFile = Document & {
  file: File;
  createdBy: Pick<User, "id" | "firstName" | "lastName">;
};

// Base session user without impersonation (to avoid circular reference)
export type BaseSessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  roleName: string;
  permissions: string[];
};

// Session types
export type SessionUser = BaseSessionUser & {
  impersonatingAs?: BaseSessionUser;  // The user being impersonated
  originalUser?: BaseSessionUser;     // The actual admin (preserved during impersonation)
};

// API Response types
export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

export type PaginatedResponse<T> = ApiResponse<{
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}>;

// Form types
export type OrderFormData = {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  buildingType: string;
  buildingSize: string;
  buildingColor?: string;
  buildingOptions?: Record<string, unknown>;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryZip: string;
  deliveryNotes?: string;
  totalPrice: number;
  depositAmount: number;
  salesRepId?: string;
  customerId?: string;
};

export type UserFormData = {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  roleId: string;
  isActive?: boolean;
};

// Permission categories
export const PERMISSION_CATEGORIES = [
  "Orders",
  "Users",
  "Roles",
  "Files",
  "Documents",
  "Communications",
  "Pay",
  "Settings",
] as const;

export type PermissionCategory = (typeof PERMISSION_CATEGORIES)[number];

// Default permissions
export const DEFAULT_PERMISSIONS = [
  // Orders
  { name: "orders.view", category: "Orders", description: "View orders" },
  { name: "orders.view_all", category: "Orders", description: "View all orders" },
  { name: "orders.create", category: "Orders", description: "Create new orders" },
  { name: "orders.edit", category: "Orders", description: "Edit orders" },
  { name: "orders.delete", category: "Orders", description: "Delete orders" },
  { name: "orders.advance_stage", category: "Orders", description: "Advance order stages" },

  // Users
  { name: "users.view", category: "Users", description: "View users" },
  { name: "users.create", category: "Users", description: "Create users" },
  { name: "users.edit", category: "Users", description: "Edit users" },
  { name: "users.delete", category: "Users", description: "Delete users" },

  // Roles
  { name: "roles.view", category: "Roles", description: "View roles" },
  { name: "roles.create", category: "Roles", description: "Create roles" },
  { name: "roles.edit", category: "Roles", description: "Edit roles" },
  { name: "roles.delete", category: "Roles", description: "Delete roles" },

  // Files
  { name: "files.view", category: "Files", description: "View files" },
  { name: "files.upload", category: "Files", description: "Upload files" },
  { name: "files.delete", category: "Files", description: "Delete files" },

  // Documents
  { name: "documents.view", category: "Documents", description: "View documents" },
  { name: "documents.create", category: "Documents", description: "Create documents" },
  { name: "documents.send", category: "Documents", description: "Send documents for signing" },

  // Communications
  { name: "messages.view", category: "Communications", description: "View messages" },
  { name: "messages.send", category: "Communications", description: "Send messages" },
  { name: "messages.view_internal", category: "Communications", description: "View internal messages" },
  { name: "emails.view", category: "Communications", description: "View emails" },
  { name: "emails.send", category: "Communications", description: "Send emails" },

  // Pay
  { name: "pay.plan.view", category: "Pay", description: "View pay plans" },
  { name: "pay.plan.edit", category: "Pay", description: "Edit pay plans" },
  { name: "pay.ledger.view", category: "Pay", description: "View pay ledger" },
  { name: "pay.ledger.edit", category: "Pay", description: "Edit pay ledger" },

  // Settings
  { name: "settings.view", category: "Settings", description: "View settings" },
  { name: "settings.edit", category: "Settings", description: "Edit settings" },
] as const;
