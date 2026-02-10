import { Badge } from "@/components/ui/badge";

interface TicketStatusBadgeProps {
  status: string;
  size?: "sm" | "default";
}

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" | "info" | "outline" }
> = {
  OPEN: { label: "Open", variant: "info" },
  IN_PROGRESS: { label: "In Progress", variant: "warning" },
  PENDING: { label: "Pending", variant: "secondary" },
  RESOLVED: { label: "Resolved", variant: "success" },
  CLOSED: { label: "Closed", variant: "default" },
};

export function TicketStatusBadge({ status, size = "default" }: TicketStatusBadgeProps) {
  const config = statusConfig[status] || { label: status, variant: "secondary" as const };

  return (
    <Badge variant={config.variant} className={size === "sm" ? "text-xs" : ""}>
      {config.label}
    </Badge>
  );
}

interface TicketPriorityBadgeProps {
  priority: string;
  size?: "sm" | "default";
}

const priorityConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" | "info" | "outline" }
> = {
  LOW: { label: "Low", variant: "secondary" },
  NORMAL: { label: "Normal", variant: "default" },
  HIGH: { label: "High", variant: "warning" },
  URGENT: { label: "Urgent", variant: "destructive" },
};

export function TicketPriorityBadge({ priority, size = "default" }: TicketPriorityBadgeProps) {
  const config = priorityConfig[priority] || { label: priority, variant: "secondary" as const };

  return (
    <Badge variant={config.variant} className={size === "sm" ? "text-xs" : ""}>
      {config.label}
    </Badge>
  );
}

interface TicketTypeBadgeProps {
  type: string;
  size?: "sm" | "default";
}

const typeLabels: Record<string, string> = {
  WELCOME_CALL: "Welcome Call",
  LPP: "LP&P",
  BUILDING_UPDATE: "Building Update",
  INFO_UPDATE: "Info Update",
  MANUFACTURER_CHANGE: "Mfr Change",
  OTHER: "Other",
};

export function TicketTypeBadge({ type, size = "default" }: TicketTypeBadgeProps) {
  const label = typeLabels[type] || type;

  return (
    <Badge variant="outline" className={size === "sm" ? "text-xs" : ""}>
      {label}
    </Badge>
  );
}
