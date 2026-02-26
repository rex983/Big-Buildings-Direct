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

  return {
    permissions,
    roleName,
    isAdmin,
    hasPermission,
  };
}
