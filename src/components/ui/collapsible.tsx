"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface CollapsibleProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

interface CollapsibleContextValue {
  open: boolean;
  toggle: () => void;
}

const CollapsibleContext = React.createContext<CollapsibleContextValue | null>(null);

function useCollapsible() {
  const context = React.useContext(CollapsibleContext);
  if (!context) {
    throw new Error("useCollapsible must be used within a Collapsible");
  }
  return context;
}

export function Collapsible({
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  className,
}: CollapsibleProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const toggle = React.useCallback(() => {
    if (isControlled) {
      onOpenChange?.(!open);
    } else {
      setUncontrolledOpen(!open);
    }
  }, [isControlled, open, onOpenChange]);

  return (
    <CollapsibleContext.Provider value={{ open, toggle }}>
      <div className={className}>{children}</div>
    </CollapsibleContext.Provider>
  );
}

interface CollapsibleTriggerProps {
  children: React.ReactNode;
  className?: string;
  asChild?: boolean;
}

export function CollapsibleTrigger({ children, className }: CollapsibleTriggerProps) {
  const { open, toggle } = useCollapsible();

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn("flex w-full items-center justify-between", className)}
      aria-expanded={open}
    >
      {children}
      <svg
        className={cn(
          "h-4 w-4 shrink-0 transition-transform duration-200",
          open && "rotate-180"
        )}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

interface CollapsibleContentProps {
  children: React.ReactNode;
  className?: string;
}

export function CollapsibleContent({ children, className }: CollapsibleContentProps) {
  const { open } = useCollapsible();

  if (!open) return null;

  return (
    <div className={cn("overflow-hidden", className)}>
      {children}
    </div>
  );
}
