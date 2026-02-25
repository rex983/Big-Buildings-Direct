"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { CancelledOrdersDialog } from "./cancelled-orders-dialog";

interface LineItem {
  id: string;
  name: string;
  amount: string;
  sortOrder: number;
}

interface LedgerEntry {
  id: string;
  month: number;
  year: number;
  buildingsSold: number;
  totalOrderAmount: string;
  planTotal: string;
  tierBonusAmount: string;
  monthlySalary: string;
  commissionAmount: string;
  cancellationDeduction: string;
  cancellationNote: string | null;
  adjustment: string;
  adjustmentNote: string | null;
  finalAmount: string;
  status: string;
  notes: string | null;
  reviewedAt: string | null;
  salesRep: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    office: string | null;
  };
  reviewedBy: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  payPlan: {
    salary?: string;
    lineItems: LineItem[];
  } | null;
}

interface PayLedgerTableProps {
  entries: LedgerEntry[];
  month: number;
  year: number;
  salesReps: { id: string; firstName: string; lastName: string }[];
}

function formatCurrency(amount: number | string) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num || 0);
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "APPROVED":
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">Approved</Badge>;
    case "REVIEWED":
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">Reviewed</Badge>;
    default:
      return <Badge variant="secondary">Pending</Badge>;
  }
}

function LedgerRow({
  entry,
  onUpdate,
  salesReps,
  month,
  year,
}: {
  entry: LedgerEntry;
  onUpdate: () => void;
  salesReps: { id: string; firstName: string; lastName: string }[];
  month: number;
  year: number;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [editingAdjustment, setEditingAdjustment] = React.useState(false);
  const [adjustmentValue, setAdjustmentValue] = React.useState(entry.adjustment);
  const [adjustmentNote, setAdjustmentNote] = React.useState(entry.adjustmentNote || "");
  const [editingCancellation, setEditingCancellation] = React.useState(false);
  const [cancellationValue, setCancellationValue] = React.useState(entry.cancellationDeduction);
  const [cancellationNote, setCancellationNote] = React.useState(entry.cancellationNote || "");
  const [updating, setUpdating] = React.useState(false);

  // Sync local state when entry prop changes
  React.useEffect(() => {
    setAdjustmentValue(entry.adjustment);
    setAdjustmentNote(entry.adjustmentNote || "");
    setCancellationValue(entry.cancellationDeduction);
    setCancellationNote(entry.cancellationNote || "");
  }, [entry.adjustment, entry.adjustmentNote, entry.cancellationDeduction, entry.cancellationNote]);

  const patchLedger = async (data: Record<string, unknown>) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/pay/ledger/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to update ledger:", error);
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveAdjustment = () => {
    patchLedger({
      adjustment: parseFloat(adjustmentValue) || 0,
      adjustmentNote,
    });
    setEditingAdjustment(false);
  };

  const handleSaveCancellation = () => {
    patchLedger({
      cancellationDeduction: parseFloat(cancellationValue) || 0,
      cancellationNote,
    });
    setEditingCancellation(false);
  };

  const handleStatusAction = (newStatus: string) => {
    patchLedger({ status: newStatus });
  };

  const tierBonus = parseFloat(entry.tierBonusAmount);
  const monthlySalary = parseFloat(entry.monthlySalary);
  const commission = parseFloat(entry.commissionAmount);
  const salary = entry.payPlan?.salary ? parseFloat(entry.payPlan.salary) : 0;
  const hasFormulaBreakdown = tierBonus > 0 || monthlySalary > 0 || commission > 0;

  return (
    <>
      <TableRow className="border-b">
        <TableCell className="font-medium">
          <button
            className="flex items-center gap-1 hover:text-primary"
            onClick={() => setExpanded(!expanded)}
          >
            <svg
              className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            {entry.salesRep.firstName} {entry.salesRep.lastName}
          </button>
        </TableCell>
        <TableCell className="text-center">{entry.buildingsSold}</TableCell>
        <TableCell className="text-right">{formatCurrency(entry.totalOrderAmount)}</TableCell>
        <TableCell className="text-right">{formatCurrency(entry.planTotal)}</TableCell>
        <TableCell className="text-right">
          {editingCancellation ? (
            <div className="flex items-center gap-1 justify-end">
              <Input
                type="number"
                value={cancellationValue}
                onChange={(e) => setCancellationValue(e.target.value)}
                className="w-24 h-7 text-xs"
                step="0.01"
                min="0"
              />
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleSaveCancellation}>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingCancellation(false)}>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>
          ) : (
            <button
              className="hover:text-primary"
              onClick={() => setEditingCancellation(true)}
              title={entry.cancellationNote || "Click to edit"}
            >
              {parseFloat(entry.cancellationDeduction) > 0 ? (
                <span className="text-red-600">-{formatCurrency(entry.cancellationDeduction)}</span>
              ) : (
                formatCurrency(0)
              )}
            </button>
          )}
        </TableCell>
        <TableCell className="text-right">
          {editingAdjustment ? (
            <div className="flex items-center gap-1 justify-end">
              <Input
                type="number"
                value={adjustmentValue}
                onChange={(e) => setAdjustmentValue(e.target.value)}
                className="w-24 h-7 text-xs"
                step="0.01"
              />
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleSaveAdjustment}>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingAdjustment(false)}>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>
          ) : (
            <button
              className="hover:text-primary"
              onClick={() => setEditingAdjustment(true)}
              title={entry.adjustmentNote || "Click to edit"}
            >
              {formatCurrency(entry.adjustment)}
            </button>
          )}
        </TableCell>
        <TableCell className="text-right font-semibold">{formatCurrency(entry.finalAmount)}</TableCell>
        <TableCell className="text-center">
          <StatusBadge status={entry.status} />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1 justify-end">
            {entry.status === "PENDING" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => handleStatusAction("REVIEWED")}
                disabled={updating}
              >
                Review
              </Button>
            )}
            {entry.status === "REVIEWED" && (
              <Button
                size="sm"
                className="h-7 text-xs bg-green-600 hover:bg-green-700"
                onClick={() => handleStatusAction("APPROVED")}
                disabled={updating}
              >
                Approve
              </Button>
            )}
            {(entry.status === "REVIEWED" || entry.status === "APPROVED") && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => handleStatusAction("PENDING")}
                disabled={updating}
              >
                Unapprove
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <tr>
          <td colSpan={9} className="bg-muted/50 px-8 py-3">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Pay Breakdown</p>
              {hasFormulaBreakdown ? (
                <div className="space-y-1 font-mono text-sm">
                  {tierBonus > 0 && (
                    <div className="flex justify-between">
                      <span>
                        Tier Bonus ({entry.buildingsSold} bldgs x{" "}
                        {formatCurrency(tierBonus / (entry.buildingsSold || 1))})
                      </span>
                      <span className="font-medium">{formatCurrency(tierBonus)}</span>
                    </div>
                  )}
                  {monthlySalary > 0 && (
                    <div className="flex justify-between">
                      <span>Monthly Salary ({formatCurrency(salary)}/12)</span>
                      <span className="font-medium">{formatCurrency(monthlySalary)}</span>
                    </div>
                  )}
                  {commission > 0 && (
                    <div className="flex justify-between">
                      <span>
                        Commission ({formatCurrency(entry.totalOrderAmount)} x{" "}
                        {parseFloat(entry.totalOrderAmount) > 0
                          ? ((commission / parseFloat(entry.totalOrderAmount)) * 100).toFixed(1)
                          : "0"}
                        %)
                      </span>
                      <span className="font-medium">{formatCurrency(commission)}</span>
                    </div>
                  )}
                  <div className="border-t border-dashed pt-1">
                    <div className="flex justify-between font-medium">
                      <span>Plan Total</span>
                      <span>{formatCurrency(entry.planTotal)}</span>
                    </div>
                  </div>
                  {parseFloat(entry.cancellationDeduction) > 0 && (
                    <div className="flex justify-between">
                      <span>
                        Cancellation
                        {entry.cancellationNote && (
                          <span className="text-muted-foreground ml-1">({entry.cancellationNote})</span>
                        )}
                      </span>
                      <span className="text-red-600">-{formatCurrency(entry.cancellationDeduction)}</span>
                    </div>
                  )}
                  {parseFloat(entry.adjustment) !== 0 && (
                    <div className="flex justify-between">
                      <span>
                        Adjustment
                        {entry.adjustmentNote && (
                          <span className="text-muted-foreground ml-1">({entry.adjustmentNote})</span>
                        )}
                      </span>
                      <span className={parseFloat(entry.adjustment) >= 0 ? "text-green-600" : "text-red-600"}>
                        {parseFloat(entry.adjustment) >= 0 ? "+" : ""}
                        {formatCurrency(entry.adjustment)}
                      </span>
                    </div>
                  )}
                  <div className="border-t-2 pt-1">
                    <div className="flex justify-between font-bold">
                      <span>Final Amount</span>
                      <span>{formatCurrency(entry.finalAmount)}</span>
                    </div>
                  </div>
                </div>
              ) : entry.payPlan && entry.payPlan.lineItems.length > 0 ? (
                <div className="space-y-1">
                  {entry.payPlan.lineItems.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>{item.name}</span>
                      <span className="font-medium">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-medium pt-1 border-t">
                    <span>Subtotal</span>
                    <span>{formatCurrency(entry.planTotal)}</span>
                  </div>
                  {parseFloat(entry.cancellationDeduction) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>
                        Cancellation
                        {entry.cancellationNote && (
                          <span className="text-muted-foreground ml-1">({entry.cancellationNote})</span>
                        )}
                      </span>
                      <span className="text-red-600">-{formatCurrency(entry.cancellationDeduction)}</span>
                    </div>
                  )}
                  {parseFloat(entry.adjustment) !== 0 && (
                    <div className="flex justify-between text-sm">
                      <span>
                        Adjustment
                        {entry.adjustmentNote && (
                          <span className="text-muted-foreground ml-1">({entry.adjustmentNote})</span>
                        )}
                      </span>
                      <span className={parseFloat(entry.adjustment) >= 0 ? "text-green-600" : "text-red-600"}>
                        {parseFloat(entry.adjustment) >= 0 ? "+" : ""}
                        {formatCurrency(entry.adjustment)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold pt-1 border-t">
                    <span>Final Amount</span>
                    <span>{formatCurrency(entry.finalAmount)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No pay plan configured</p>
              )}

              {editingCancellation && (
                <div className="pt-2">
                  <Input
                    placeholder="Cancellation note..."
                    value={cancellationNote}
                    onChange={(e) => setCancellationNote(e.target.value)}
                    className="text-sm"
                  />
                </div>
              )}

              {editingAdjustment && (
                <div className="pt-2">
                  <Input
                    placeholder="Adjustment note..."
                    value={adjustmentNote}
                    onChange={(e) => setAdjustmentNote(e.target.value)}
                    className="text-sm"
                  />
                </div>
              )}

              {entry.notes && (
                <div className="pt-2">
                  <p className="text-sm text-muted-foreground">Notes: {entry.notes}</p>
                </div>
              )}

              {entry.reviewedBy && (
                <p className="text-xs text-muted-foreground pt-1">
                  Reviewed by {entry.reviewedBy.firstName} {entry.reviewedBy.lastName}
                  {entry.reviewedAt && ` on ${new Date(entry.reviewedAt).toLocaleDateString()}`}
                </p>
              )}

              <div className="pt-2">
                <CancelledOrdersDialog
                  month={entry.month}
                  year={entry.year}
                  salesReps={[{ id: entry.salesRep.id, firstName: entry.salesRep.firstName, lastName: entry.salesRep.lastName }]}
                  initialSalesRepId={entry.salesRep.id}
                  trigger={
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                      View Cancellations
                    </Button>
                  }
                />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function LedgerTable({
  entries: tableEntries,
  onUpdate,
  salesReps,
  month,
  year,
}: {
  entries: LedgerEntry[];
  onUpdate: () => void;
  salesReps: { id: string; firstName: string; lastName: string }[];
  month: number;
  year: number;
}) {
  if (tableEntries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No entries for this office.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Sales Rep</TableHead>
          <TableHead className="text-center">Buildings Sold</TableHead>
          <TableHead className="text-right">Total Sales</TableHead>
          <TableHead className="text-right">Plan Total</TableHead>
          <TableHead className="text-right">Cancellation</TableHead>
          <TableHead className="text-right">Adjustment</TableHead>
          <TableHead className="text-right">Final Amount</TableHead>
          <TableHead className="text-center">Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tableEntries.map((entry) => (
          <LedgerRow
            key={entry.id}
            entry={entry}
            onUpdate={onUpdate}
            salesReps={salesReps}
            month={month}
            year={year}
          />
        ))}
      </TableBody>
    </Table>
  );
}

function OfficeLedgerSections({
  data,
  onUpdate,
  salesReps,
  month,
  year,
}: {
  data: LedgerEntry[];
  onUpdate: () => void;
  salesReps: { id: string; firstName: string; lastName: string }[];
  month: number;
  year: number;
}) {
  const marionEntries = data.filter((e) => e.salesRep.office === "Marion Office");
  const harborEntries = data.filter((e) => e.salesRep.office === "Harbor Office");
  const unassignedEntries = data.filter((e) => !e.salesRep.office);

  const renderSection = (title: string, sectionEntries: LedgerEntry[]) => {
    if (sectionEntries.length === 0) return null;

    const totalFinal = sectionEntries.reduce(
      (sum, e) => sum + (parseFloat(e.finalAmount) || 0),
      0
    );

    return (
      <Collapsible defaultOpen className="rounded-lg border bg-card">
        <CollapsibleTrigger className="px-4 py-3 hover:bg-muted/50 rounded-lg transition-colors w-full">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{title}</h3>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>{sectionEntries.length} rep{sectionEntries.length !== 1 ? "s" : ""}</span>
              <span className="font-medium text-foreground">{formatCurrency(totalFinal)}</span>
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 pb-4">
          <LedgerTable
            entries={sectionEntries}
            onUpdate={onUpdate}
            salesReps={salesReps}
            month={month}
            year={year}
          />
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <div className="space-y-4">
      {renderSection("Marion Office", marionEntries)}
      {renderSection("Harbor Office", harborEntries)}
      {renderSection("Unassigned Office", unassignedEntries)}
    </div>
  );
}

export function PayLedgerTable({ entries, month, year, salesReps }: PayLedgerTableProps) {
  const [data, setData] = React.useState(entries);
  const [generating, setGenerating] = React.useState(false);

  // Sync with prop changes
  React.useEffect(() => {
    setData(entries);
  }, [entries]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/pay/ledger/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year }),
      });
      const result = await res.json();
      if (result.success) {
        // Refresh ledger data
        await refreshData();
      }
    } catch (error) {
      console.error("Failed to generate ledger:", error);
    } finally {
      setGenerating(false);
    }
  };

  const refreshData = async () => {
    try {
      const res = await fetch(`/api/pay/ledger?month=${month}&year=${year}`);
      const result = await res.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error("Failed to refresh ledger:", error);
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Payroll Ledger</CardTitle>
          <div className="flex items-center gap-2">
            <CancelledOrdersDialog
              month={month}
              year={year}
              salesReps={salesReps}
            />
            <Button onClick={handleGenerate} disabled={generating} size="sm">
              {generating ? "Generating..." : data.length > 0 ? "Refresh Ledger" : "Generate Ledger"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No ledger entries yet. Click &quot;Generate Ledger&quot; to create entries for all sales reps.
          </p>
        ) : (
          <OfficeLedgerSections
            data={data}
            onUpdate={refreshData}
            salesReps={salesReps}
            month={month}
            year={year}
          />
        )}
      </CardContent>
    </Card>
  );
}
