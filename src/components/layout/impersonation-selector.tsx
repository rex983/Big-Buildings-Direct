"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useImpersonation } from "@/hooks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: {
    id: string;
    name: string;
  };
  isActive: boolean;
}

// Employee roles that can be viewed as
const EMPLOYEE_ROLES = ["Admin", "Manager", "BST", "Sales Rep"];

function BriefcaseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}

export function ImpersonationSelector() {
  const { data: session } = useSession();
  const { isImpersonating, startImpersonation, loading, error } = useImpersonation();
  const [users, setUsers] = React.useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = React.useState<User[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [fetching, setFetching] = React.useState(false);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Check if current user can impersonate (Admin only)
  const actualUser = session?.user?.originalUser || session?.user;
  const canImpersonate = actualUser?.roleName === "Admin";

  // Don't show if user cannot impersonate or is already impersonating
  if (!canImpersonate || isImpersonating) {
    return null;
  }

  const fetchUsers = async () => {
    if (users.length > 0) return; // Already fetched

    setFetching(true);
    setFetchError(null);

    try {
      const response = await fetch("/api/users?pageSize=100");
      const data = await response.json();

      if (data.success) {
        // Filter to only show active employees (not customers)
        const employees = data.data.items.filter(
          (u: User) => u.isActive && EMPLOYEE_ROLES.includes(u.role.name)
        );
        setUsers(employees);
        setFilteredUsers(employees);
      } else {
        setFetchError("Failed to load employees");
      }
    } catch {
      setFetchError("Failed to load employees");
    } finally {
      setFetching(false);
    }
  };

  const handleOpenChange = async (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setSearchQuery("");
      if (users.length === 0) {
        await fetchUsers();
      } else {
        setFilteredUsers(users);
      }
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    const lowerQuery = query.toLowerCase();
    const filtered = users.filter(
      (u) =>
        u.firstName.toLowerCase().includes(lowerQuery) ||
        u.lastName.toLowerCase().includes(lowerQuery) ||
        u.email.toLowerCase().includes(lowerQuery) ||
        u.role.name.toLowerCase().includes(lowerQuery)
    );
    setFilteredUsers(filtered);
  };

  const handleSelect = async (userId: string) => {
    const success = await startImpersonation(userId);
    if (success) {
      setIsOpen(false);
      // Refresh to apply the impersonation
      window.location.reload();
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="View as employee"
          title="View as Employee"
        >
          <BriefcaseIcon className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>View as Employee</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Search input */}
        <div className="px-2 py-2">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search employees..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <DropdownMenuSeparator />

        {/* Employee list */}
        <div className="max-h-64 overflow-y-auto">
          {fetching && (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              Loading employees...
            </div>
          )}

          {fetchError && (
            <div className="px-2 py-4 text-center text-sm text-destructive">
              {fetchError}
            </div>
          )}

          {error && (
            <div className="px-2 py-2 text-center text-sm text-destructive">
              {error}
            </div>
          )}

          {!fetching && !fetchError && filteredUsers.length === 0 && (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              {searchQuery ? "No employees match your search" : "No employees available"}
            </div>
          )}

          {filteredUsers.map((user) => (
            <DropdownMenuItem
              key={user.id}
              onClick={() => handleSelect(user.id)}
              disabled={loading}
              className="flex flex-col items-start gap-0.5 py-2 cursor-pointer"
            >
              <span className="font-medium">
                {user.firstName} {user.lastName}
              </span>
              <span className="text-xs text-muted-foreground">{user.email}</span>
              <span className="text-xs text-muted-foreground">
                Role: {user.role.name}
              </span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
