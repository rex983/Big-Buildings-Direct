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
    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
      Completed
    </span>
  );

  const pendingBadge = (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
      Pending
    </span>
  );

  return (
    <div className="flex flex-col items-center gap-0.5" title={label}>
      {displayChecked ? completedBadge : pendingBadge}
    </div>
  );
}
