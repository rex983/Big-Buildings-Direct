"use client";

import { useState } from "react";

interface StatusCheckboxProps {
  orderId: string;
  field: "depositCollected" | "sentToCustomer" | "customerSigned" | "sentToManufacturer";
  checked: boolean;
  canEdit: boolean;
  label: string;
}

export function StatusCheckbox({
  checked,
  label,
}: StatusCheckboxProps) {
  const [displayChecked] = useState(checked);

  const completedBadge = (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/50 dark:text-green-300">
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      Completed
    </span>
  );

  const pendingBadge = (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/50 dark:text-red-300">
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <circle cx="12" cy="12" r="4" />
      </svg>
      Pending
    </span>
  );

  return (
    <div className="flex flex-col items-center gap-0.5" title={label}>
      {displayChecked ? completedBadge : pendingBadge}
    </div>
  );
}
