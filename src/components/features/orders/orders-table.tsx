"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusCheckbox } from "@/components/features/orders/status-checkbox";
import {
  COLUMNS,
  ACTIONS_COLUMN,
  type ColumnDef,
} from "@/components/features/orders/orders-table-columns";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";
import { useTablePreferences } from "@/hooks/use-table-preferences";
import type { DisplayOrder } from "@/types/order-process";

interface OrdersTableProps {
  orders: DisplayOrder[];
  canEditStatus: boolean;
}

const columnMap = new Map(COLUMNS.map((c) => [c.id, c]));

export function OrdersTable({ orders, canEditStatus }: OrdersTableProps) {
  const { prefs, setColumnOrder, setColumnWidth, toggleColumnVisibility, resetPreferences } =
    useTablePreferences();

  // ── Drag-and-drop state ──────────────────────────────────────────────
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent, columnId: string) => {
      setDragSourceId(columnId);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", columnId);
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, columnId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (columnId !== dragSourceId) {
        setDragOverId(columnId);
      }
    },
    [dragSourceId]
  );

  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      const sourceId = e.dataTransfer.getData("text/plain");
      if (!sourceId || sourceId === targetId) {
        setDragSourceId(null);
        setDragOverId(null);
        return;
      }
      const order = [...prefs.columnOrder];
      const fromIdx = order.indexOf(sourceId);
      const toIdx = order.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1) return;
      order.splice(fromIdx, 1);
      order.splice(toIdx, 0, sourceId);
      setColumnOrder(order);
      setDragSourceId(null);
      setDragOverId(null);
    },
    [prefs.columnOrder, setColumnOrder]
  );

  const handleDragEnd = useCallback(() => {
    setDragSourceId(null);
    setDragOverId(null);
  }, []);

  // ── Resize state ─────────────────────────────────────────────────────
  const resizingRef = useRef<{
    columnId: string;
    startX: number;
    startWidth: number;
    minWidth: number;
  } | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, col: ColumnDef) => {
      e.preventDefault();
      e.stopPropagation();
      const currentWidth = prefs.columnWidths[col.id] ?? col.defaultWidth;
      resizingRef.current = {
        columnId: col.id,
        startX: e.clientX,
        startWidth: currentWidth,
        minWidth: col.minWidth,
      };
      setResizingId(col.id);
    },
    [prefs.columnWidths]
  );

  useEffect(() => {
    if (!resizingId) return;

    const handleMouseMove = (e: MouseEvent) => {
      const info = resizingRef.current;
      if (!info) return;
      const delta = e.clientX - info.startX;
      const newWidth = Math.max(info.minWidth, info.startWidth + delta);
      setColumnWidth(info.columnId, newWidth);
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
      setResizingId(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizingId, setColumnWidth]);

  // ── Ordered columns ──────────────────────────────────────────────────
  const hiddenSet = new Set(prefs.hiddenColumns);
  const orderedColumns: ColumnDef[] = prefs.columnOrder
    .map((id) => columnMap.get(id))
    .filter((c): c is ColumnDef => !!c && !hiddenSet.has(c.id));

  // ── Cell renderer ────────────────────────────────────────────────────
  function renderCell(columnId: string, order: DisplayOrder) {
    switch (columnId) {
      case "orderNumber":
        return (
          <span className="font-medium">
            {order.orderNumber}
            {order.status === "cancelled" && (
              <span className="ml-2">
                <Badge variant="destructive">Cancelled</Badge>
              </span>
            )}
          </span>
        );
      case "dateSold":
        return <span className="whitespace-nowrap">{order.dateSold ? formatDate(order.dateSold) : "—"}</span>;
      case "customer":
        return (
          <div>
            <p>{order.customerName}</p>
            <p className="text-sm text-muted-foreground">{order.customerEmail}</p>
          </div>
        );
      case "state":
        return order.deliveryState;
      case "salesRep":
        return <span className="text-sm">{order.salesPerson}</span>;
      case "total":
        return <span className="font-medium">{formatCurrency(order.totalPrice)}</span>;
      case "deposit":
        return <span className="font-medium">{formatCurrency(order.depositAmount)}</span>;
      case "payment":
        return (
          <>
            <Badge
              variant={
                order.paymentStatus === "paid" ||
                order.paymentStatus === "manually_approved"
                  ? "success"
                  : order.paymentStatus === "pending"
                    ? "warning"
                    : "secondary"
              }
            >
              {order.paymentStatus === "paid"
                ? "Paid"
                : order.paymentStatus === "manually_approved"
                  ? "Approved"
                  : order.paymentStatus === "pending"
                    ? "Pending"
                    : "Unpaid"}
            </Badge>
            {order.paymentType && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {order.paymentType === "stripe_already_paid"
                  ? "Stripe"
                  : order.paymentType === "check"
                    ? "Check"
                    : order.paymentType === "wire"
                      ? "Wire"
                      : order.paymentType.replace(/_/g, " ")}
              </p>
            )}
          </>
        );
      case "sentToCustomer":
        return (
          <StatusCheckbox
            orderId={order.id}
            field="sentToCustomer"
            checked={order.sentToCustomer}
            canEdit={canEditStatus}
            label="Sent to Customer"
          />
        );
      case "signed":
        return (
          <StatusCheckbox
            orderId={order.id}
            field="customerSigned"
            checked={order.customerSigned}
            canEdit={canEditStatus}
            label="Customer Signed"
          />
        );
      case "sentToMfr":
        return (
          <StatusCheckbox
            orderId={order.id}
            field="sentToManufacturer"
            checked={order.sentToManufacturer}
            canEdit={canEditStatus}
            label="Sent to Manufacturer"
          />
        );
      case "created":
        return formatDate(order.createdAt);
      default:
        return null;
    }
  }

  // ── Alignment class helper ───────────────────────────────────────────
  function alignClass(align: "left" | "center" | "right") {
    if (align === "center") return "text-center";
    if (align === "right") return "text-right";
    return "";
  }

  return (
    <div>
      <div className="flex justify-end gap-2 mb-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 max-h-72 overflow-y-auto">
            {COLUMNS.map((col) => (
              <label
                key={col.id}
                className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
              >
                <input
                  type="checkbox"
                  checked={!prefs.hiddenColumns.includes(col.id)}
                  onChange={() => toggleColumnVisibility(col.id)}
                  className="accent-primary"
                />
                {col.label}
              </label>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="sm" onClick={resetPreferences}>
          Reset columns
        </Button>
      </div>
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            {orderedColumns.map((col) => (
              <TableHead
                key={col.id}
                draggable
                onDragStart={(e) => handleDragStart(e, col.id)}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
                onDragEnd={handleDragEnd}
                className={`relative select-none ${alignClass(col.align)} ${
                  dragOverId === col.id ? "bg-accent" : ""
                } ${dragSourceId === col.id ? "opacity-50" : ""}`}
                style={{
                  width: prefs.columnWidths[col.id] ?? col.defaultWidth,
                  cursor: "grab",
                }}
              >
                {col.label}
                {/* Resize handle */}
                <span
                  onMouseDown={(e) => handleResizeStart(e, col)}
                  className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/30"
                  style={{
                    background: resizingId === col.id ? "hsl(var(--primary) / 0.4)" : undefined,
                  }}
                />
              </TableHead>
            ))}
            {/* Actions column — pinned last, not draggable */}
            <TableHead
              className={alignClass(ACTIONS_COLUMN.align)}
              style={{
                width:
                  prefs.columnWidths[ACTIONS_COLUMN.id] ??
                  ACTIONS_COLUMN.defaultWidth,
              }}
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              {orderedColumns.map((col) => (
                <TableCell
                  key={col.id}
                  className={alignClass(col.align)}
                  style={{
                    width: prefs.columnWidths[col.id] ?? col.defaultWidth,
                  }}
                >
                  {renderCell(col.id, order)}
                </TableCell>
              ))}
              <TableCell
                className={alignClass(ACTIONS_COLUMN.align)}
                style={{
                  width:
                    prefs.columnWidths[ACTIONS_COLUMN.id] ??
                    ACTIONS_COLUMN.defaultWidth,
                }}
              >
                <Link href={`/orders/${order.id}`}>
                  <Button variant="ghost" size="sm">
                    View
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
