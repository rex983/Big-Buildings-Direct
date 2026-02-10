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

interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
}

function UsersIcon({ className }: { className?: string }) {
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
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  );
}

export function CustomerViewSelector() {
  const { data: session } = useSession();
  const { isImpersonating, startImpersonation, loading, error } = useImpersonation();
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = React.useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [fetching, setFetching] = React.useState(false);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [customerRoleId, setCustomerRoleId] = React.useState<string | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Check if current user can view as customer (Admin only for now)
  const actualUser = session?.user?.originalUser || session?.user;
  const canViewAsCustomer = actualUser?.roleName === "Admin";

  // Don't show if user cannot view as customer or is already impersonating
  if (!canViewAsCustomer || isImpersonating) {
    return null;
  }

  const fetchCustomerRoleId = async () => {
    try {
      const response = await fetch("/api/roles");
      const data = await response.json();
      if (data.success) {
        const customerRole = data.data.find((r: { name: string }) => r.name === "Customer");
        if (customerRole) {
          setCustomerRoleId(customerRole.id);
          return customerRole.id;
        }
      }
    } catch {
      console.error("Failed to fetch customer role");
    }
    return null;
  };

  const fetchCustomers = async (roleId: string) => {
    setFetching(true);
    setFetchError(null);

    try {
      const response = await fetch(`/api/users?roleId=${roleId}&pageSize=100`);
      const data = await response.json();

      if (data.success) {
        const activeCustomers = data.data.items.filter((u: Customer) => u.isActive);
        setCustomers(activeCustomers);
        setFilteredCustomers(activeCustomers);
      } else {
        setFetchError("Failed to load customers");
      }
    } catch {
      setFetchError("Failed to load customers");
    } finally {
      setFetching(false);
    }
  };

  const handleOpenChange = async (open: boolean) => {
    setIsOpen(open);
    if (open) {
      // Reset search on open
      setSearchQuery("");

      // Fetch role ID if not already fetched
      let roleId = customerRoleId;
      if (!roleId) {
        roleId = await fetchCustomerRoleId();
      }

      // Fetch customers if we have the role ID
      if (roleId && customers.length === 0) {
        await fetchCustomers(roleId);
      } else {
        setFilteredCustomers(customers);
      }

      // Focus search input after dropdown opens
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    const lowerQuery = query.toLowerCase();
    const filtered = customers.filter(
      (c) =>
        c.firstName.toLowerCase().includes(lowerQuery) ||
        c.lastName.toLowerCase().includes(lowerQuery) ||
        c.email.toLowerCase().includes(lowerQuery)
    );
    setFilteredCustomers(filtered);
  };

  const handleSelect = async (customerId: string) => {
    const success = await startImpersonation(customerId);
    if (success) {
      setIsOpen(false);
      // Redirect to customer portal after impersonation
      window.location.href = "/portal";
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="View as customer"
          title="View as Customer"
        >
          <UsersIcon className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>View as Customer</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Search input */}
        <div className="px-2 py-2">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <DropdownMenuSeparator />

        {/* Customer list */}
        <div className="max-h-64 overflow-y-auto">
          {fetching && (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              Loading customers...
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

          {!fetching && !fetchError && filteredCustomers.length === 0 && (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              {searchQuery ? "No customers match your search" : "No customers found"}
            </div>
          )}

          {filteredCustomers.map((customer) => (
            <DropdownMenuItem
              key={customer.id}
              onClick={() => handleSelect(customer.id)}
              disabled={loading}
              className="flex flex-col items-start gap-0.5 py-2 cursor-pointer"
            >
              <span className="font-medium">
                {customer.firstName} {customer.lastName}
              </span>
              <span className="text-xs text-muted-foreground">{customer.email}</span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
