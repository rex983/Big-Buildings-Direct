// Enum-like constants
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

// Session types
export type BaseSessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  office?: string;
};

export type SessionUser = BaseSessionUser & {
  impersonatingAs?: BaseSessionUser;
  originalUser?: BaseSessionUser;
};

// Default permissions (used by seed scripts)
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
