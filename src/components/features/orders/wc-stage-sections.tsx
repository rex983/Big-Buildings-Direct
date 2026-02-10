"use client";

import { Card, CardContent } from "@/components/ui/card";
import { PipelineOrderActions } from "./pipeline-order-actions";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusSelect } from "./status-select";
import { formatDate } from "@/lib/utils";

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  buildingType: string;
  buildingSize: string;
  installer: string | null;
  wcStatus: string | null;
  lppStatus: string | null;
  sentToManufacturerDate: Date | null;
  salesRep: { firstName: string; lastName: string } | null;
}

interface WcStageSectionsProps {
  stmPendingOrders: Order[];
  wcPendingOrders: Order[];
  noContactMadeOrders: Order[];
  canEdit: boolean;
}

// WC Status options for the dropdown
const wcStatusOptions = [
  { value: "Pending", label: "Pending", color: "gray" },
  { value: "No Contact Made", label: "No Contact Made", color: "orange" },
  { value: "Contact Made", label: "Contact Made", color: "green" },
];

// LP&P Status options for the dropdown
const lppStatusOptions = [
  { value: "Pending", label: "Pending", color: "gray" },
  { value: "Ready for Install", label: "Ready for Install", color: "green" },
];

interface StageConfig {
  key: string;
  title: string;
  description: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  badgeColor: string;
}

const stages: StageConfig[] = [
  {
    key: "stmPending",
    title: "Stage 1: STM Pending",
    description: "Orders sent to manufacturer, BST hasn't started outreach",
    bgColor: "bg-slate-50",
    textColor: "text-slate-700",
    borderColor: "border-slate-200",
    badgeColor: "bg-slate-600",
  },
  {
    key: "wcPending",
    title: "Stage 2: WC Pending",
    description: "BST acknowledged, starting outreach process",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
    badgeColor: "bg-blue-600",
  },
  {
    key: "noContactMade",
    title: "Stage 3: No Contact Made",
    description: "Attempted contact but no response from customer",
    bgColor: "bg-orange-50",
    textColor: "text-orange-700",
    borderColor: "border-orange-200",
    badgeColor: "bg-orange-500",
  },
];

function OrdersTable({ orders, canEdit }: { orders: Order[]; canEdit: boolean }) {
  if (orders.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-4">
        No orders in this stage
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order #</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Building</TableHead>
          <TableHead>Installer</TableHead>
          <TableHead>WC Status</TableHead>
          <TableHead>LP&P</TableHead>
          <TableHead>Sales Rep</TableHead>
          <TableHead>Sent Date</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell className="font-medium">{order.orderNumber}</TableCell>
            <TableCell>
              <div>
                <p>{order.customerName}</p>
                <p className="text-sm text-muted-foreground">{order.customerEmail}</p>
                {order.customerPhone && (
                  <p className="text-sm text-muted-foreground">{order.customerPhone}</p>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div>
                <p>{order.buildingType}</p>
                <p className="text-sm text-muted-foreground">{order.buildingSize}</p>
              </div>
            </TableCell>
            <TableCell>
              {order.installer || (
                <span className="text-muted-foreground">Not assigned</span>
              )}
            </TableCell>
            <TableCell>
              <StatusSelect
                orderId={order.id}
                field="wcStatus"
                value={order.wcStatus}
                options={wcStatusOptions}
                canEdit={canEdit}
                label="Welcome Call Status"
              />
            </TableCell>
            <TableCell>
              <StatusSelect
                orderId={order.id}
                field="lppStatus"
                value={order.lppStatus}
                options={lppStatusOptions}
                canEdit={canEdit}
                label="LP&P Status"
              />
            </TableCell>
            <TableCell>
              {order.salesRep ? (
                <span className="text-sm">
                  {order.salesRep.firstName} {order.salesRep.lastName}
                </span>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell>
              {order.sentToManufacturerDate
                ? formatDate(order.sentToManufacturerDate)
                : "-"}
            </TableCell>
            <TableCell>
              <PipelineOrderActions
                orderId={order.id}
                orderNumber={order.orderNumber}
                customerName={order.customerName}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function WcStageSections({
  stmPendingOrders,
  wcPendingOrders,
  noContactMadeOrders,
  canEdit,
}: WcStageSectionsProps) {
  const ordersByStage: Record<string, Order[]> = {
    stmPending: stmPendingOrders,
    wcPending: wcPendingOrders,
    noContactMade: noContactMadeOrders,
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Welcome Call Stages</h2>
      <p className="text-muted-foreground text-sm">
        Manage orders through the Welcome Call process. Expand each stage to view and update orders.
      </p>

      <div className="space-y-3">
        {stages.map((stage) => {
          const orders = ordersByStage[stage.key];
          const count = orders.length;

          return (
            <Card key={stage.key} className={`${stage.borderColor} border-2`}>
              <Collapsible defaultOpen={count > 0 && count <= 10}>
                <CollapsibleTrigger
                  className={`w-full p-4 ${stage.bgColor} rounded-t-lg hover:opacity-90 transition-opacity`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`${stage.badgeColor} text-white text-sm font-bold px-2.5 py-1 rounded-full`}
                    >
                      {count}
                    </span>
                    <div className="text-left">
                      <h3 className={`font-semibold ${stage.textColor}`}>
                        {stage.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {stage.description}
                      </p>
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-4">
                    <OrdersTable orders={orders} canEdit={canEdit} />
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
