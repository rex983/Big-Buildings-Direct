"use client";

import * as React from "react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

interface PayPlanSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function PayPlanSection({
  title,
  defaultOpen = false,
  children,
}: PayPlanSectionProps) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="rounded-lg border bg-card">
      <CollapsibleTrigger className="px-4 py-3 hover:bg-muted/50 rounded-lg transition-colors">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">
        <div className="space-y-4 pt-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
