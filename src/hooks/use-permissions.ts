"use client";

import { useSession } from "next-auth/react";
import { useMemo } from "react";

export function usePermissions() {
  const { data: session, status } = useSession();

  const permissions = useMemo(() => {
    return session?.user?.permissions ?? [];
  }, [session]);

  const roleName = session?.user?.roleName ?? "";
  const isAdmin = roleName === "Admin";

  const hasPermission = (required: string | string[]): boolean => {
    if (isAdmin) return true;
    const requiredPerms = Array.isArray(required) ? required : [required];
    return requiredPerms.some((perm) => permissions.includes(perm));
  };

  const hasAllPermissions = (required: string[]): boolean => {
    if (isAdmin) return true;
    return required.every((perm) => permissions.includes(perm));
  };

  const canViewOrders = hasPermission(["orders.view", "orders.view_all"]);
  const canViewAllOrders = hasPermission("orders.view_all");
  const canCreateOrders = hasPermission("orders.create");
  const canEditOrders = hasPermission("orders.edit");
  const canDeleteOrders = hasPermission("orders.delete");
  const canAdvanceStages = hasPermission("orders.advance_stage");

  const canViewUsers = hasPermission("users.view");
  const canCreateUsers = hasPermission("users.create");
  const canEditUsers = hasPermission("users.edit");
  const canDeleteUsers = hasPermission("users.delete");

  const canViewRoles = hasPermission("roles.view");
  const canCreateRoles = hasPermission("roles.create");
  const canEditRoles = hasPermission("roles.edit");
  const canDeleteRoles = hasPermission("roles.delete");

  const canViewFiles = hasPermission("files.view");
  const canUploadFiles = hasPermission("files.upload");
  const canDeleteFiles = hasPermission("files.delete");

  const canViewDocuments = hasPermission("documents.view");
  const canCreateDocuments = hasPermission("documents.create");
  const canSendDocuments = hasPermission("documents.send");

  const canViewMessages = hasPermission("messages.view");
  const canSendMessages = hasPermission("messages.send");
  const canViewInternalMessages = hasPermission("messages.view_internal");

  const canViewEmails = hasPermission("emails.view");
  const canSendEmails = hasPermission("emails.send");

  const canViewSettings = hasPermission("settings.view");
  const canEditSettings = hasPermission("settings.edit");

  return {
    // Raw data
    permissions,
    roleName,
    isAdmin,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",

    // Helper functions
    hasPermission,
    hasAllPermissions,

    // Computed permissions
    canViewOrders,
    canViewAllOrders,
    canCreateOrders,
    canEditOrders,
    canDeleteOrders,
    canAdvanceStages,

    canViewUsers,
    canCreateUsers,
    canEditUsers,
    canDeleteUsers,

    canViewRoles,
    canCreateRoles,
    canEditRoles,
    canDeleteRoles,

    canViewFiles,
    canUploadFiles,
    canDeleteFiles,

    canViewDocuments,
    canCreateDocuments,
    canSendDocuments,

    canViewMessages,
    canSendMessages,
    canViewInternalMessages,

    canViewEmails,
    canSendEmails,

    canViewSettings,
    canEditSettings,
  };
}
