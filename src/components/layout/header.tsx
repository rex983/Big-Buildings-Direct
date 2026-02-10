"use client";

import { useSession, signOut } from "next-auth/react";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ImpersonationSelector } from "@/components/layout/impersonation-selector";
import { CustomerViewSelector } from "@/components/layout/customer-view-selector";
import { getInitials } from "@/lib/utils";
import Link from "next/link";

export function Header() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">Order Management</h1>
      </div>

      <div className="flex items-center gap-4">
        <CustomerViewSelector />
        <ImpersonationSelector />
        <ThemeToggle />
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg p-2 hover:bg-accent">
                <Avatar
                  fallback={getInitials(user.firstName, user.lastName)}
                  size="sm"
                />
                <span className="text-sm font-medium">
                  {user.firstName} {user.lastName}
                </span>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>
                    {user.firstName} {user.lastName}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {user.email}
                  </span>
                  <span className="mt-1 text-xs font-normal text-muted-foreground">
                    Role: {user.roleName}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <Link href="/settings/profile">
                <DropdownMenuItem>Profile Settings</DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="text-destructive focus:text-destructive"
              >
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
