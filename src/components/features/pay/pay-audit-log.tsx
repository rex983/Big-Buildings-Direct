"use client";

import * as React from "react";

interface AuditEntry {
  id: string;
  action: string;
  description: string;
  metadata: string | null;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface PayAuditLogProps {
  entries: AuditEntry[];
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  SALARY_UPDATED: { label: "Salary", color: "bg-blue-100 text-blue-800" },
  LINE_ITEMS_UPDATED: { label: "Line Items", color: "bg-purple-100 text-purple-800" },
  OFFICE_TIERS_UPDATED: { label: "Tiers", color: "bg-amber-100 text-amber-800" },
  LEDGER_GENERATED: { label: "Ledger Gen", color: "bg-green-100 text-green-800" },
  LEDGER_ADJUSTED: { label: "Ledger Edit", color: "bg-red-100 text-red-800" },
};

export function PayAuditLog({ entries }: PayAuditLogProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        No activity recorded yet.
      </div>
    );
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-1 mt-4">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-muted-foreground">
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Who</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const actionInfo = ACTION_LABELS[entry.action] ?? {
                label: entry.action,
                color: "bg-gray-100 text-gray-800",
              };
              return (
                <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2 whitespace-nowrap text-muted-foreground text-xs">
                    {formatDate(entry.createdAt)}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap font-medium">
                    {entry.user.firstName} {entry.user.lastName}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${actionInfo.color}`}
                    >
                      {actionInfo.label}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {entry.description}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
