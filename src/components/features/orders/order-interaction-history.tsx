"use client";

import { useState } from "react";
import type { InteractionItem, InteractionVariant } from "@/lib/queries/interaction-history";

const variantDot: Record<InteractionVariant, string> = {
  success: "bg-green-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
  info: "bg-blue-500",
  default: "bg-gray-400",
};

const variantBadge: Record<InteractionVariant, string> = {
  success: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  error: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  default: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

function formatTimestamp(ts: string): string {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function TimelineItem({ item, isLast }: { item: InteractionItem; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = item.details && Object.keys(item.details).length > 0;

  return (
    <div className="flex gap-3">
      {/* Dot + line */}
      <div className="flex flex-col items-center w-5 shrink-0">
        <span className={`w-3 h-3 rounded-full shrink-0 mt-1 ${variantDot[item.statusVariant]}`} />
        {!isLast && <div className="w-0.5 flex-1 bg-border mt-1" />}
      </div>

      {/* Content */}
      <div className="pb-5 flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold truncate">{item.title}</span>
          <span
            className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${variantBadge[item.statusVariant]}`}
          >
            {item.status}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
        <p className="text-xs text-muted-foreground/70 mt-0.5">
          {formatTimestamp(item.timestamp)}
        </p>

        {hasDetails && (
          <>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-primary hover:underline mt-1"
            >
              {expanded ? "Hide details" : "Show details"}
            </button>
            {expanded && (
              <div className="mt-2 rounded-md bg-muted/50 p-3 space-y-1">
                {Object.entries(item.details!).map(([key, value]) => (
                  <div key={key} className="flex gap-2 text-xs">
                    <span className="text-muted-foreground font-medium min-w-[80px]">{key}:</span>
                    <span className="break-words">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface OrderInteractionHistoryProps {
  items: InteractionItem[];
}

export function OrderInteractionHistory({ items }: OrderInteractionHistoryProps) {
  if (items.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-6 text-sm">
        No interaction history yet
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      {items.map((item, i) => (
        <TimelineItem key={item.id} item={item} isLast={i === items.length - 1} />
      ))}
    </div>
  );
}
