"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface TierData {
  type: "BUILDINGS_SOLD" | "ORDER_TOTAL";
  minValue: string;
  maxValue: string;
  bonusAmount: string;
  bonusType: "FLAT" | "PERCENTAGE";
}

interface SalaryRep {
  id: string;
  firstName: string;
  lastName: string;
  salary: string;
  cancellationDeduction: string;
  buildingsSold: number;
  totalOrderAmount: string;
}

interface SalaryTableProps {
  reps: SalaryRep[];
  tiers: TierData[];
  month: number;
  year: number;
  canEdit: boolean;
}

interface PendingChange {
  repId: string;
  repName: string;
  field: "salary" | "cancellationDeduction";
  oldValue: string;
  newValue: string;
}

function findMatchingTier(value: number, tiers: TierData[]): TierData | null {
  for (const tier of tiers) {
    const min = parseFloat(tier.minValue) || 0;
    const max = tier.maxValue ? parseFloat(tier.maxValue) : Infinity;
    if (value >= min && value <= max) {
      return tier;
    }
  }
  return null;
}

function calculateTierBonus(buildingsSold: number, tiers: TierData[]): number {
  const buildingSoldTiers = tiers.filter((t) => t.type === "BUILDINGS_SOLD");
  const buildingTier = findMatchingTier(buildingsSold, buildingSoldTiers);
  if (buildingTier) {
    return buildingsSold * (parseFloat(buildingTier.bonusAmount) || 0);
  }
  return 0;
}

function calculatePay(
  buildingsSold: number,
  totalOrderAmount: string,
  salary: string,
  cancellation: string,
  tiers: TierData[]
): number {
  const tierBonus = calculateTierBonus(buildingsSold, tiers);

  // Monthly salary: salary / 12
  const salaryNum = parseFloat(salary) || 0;
  const monthlySalary = salaryNum > 0 ? salaryNum / 12 : 0;

  // Commission from ORDER_TOTAL tiers
  let commission = 0;
  const orderAmount = parseFloat(totalOrderAmount) || 0;
  const orderTotalTiers = tiers.filter((t) => t.type === "ORDER_TOTAL");
  const orderTier = findMatchingTier(orderAmount, orderTotalTiers);
  if (orderTier) {
    if (orderTier.bonusType === "PERCENTAGE") {
      commission = orderAmount * (parseFloat(orderTier.bonusAmount) || 0) / 100;
    } else {
      commission = parseFloat(orderTier.bonusAmount) || 0;
    }
  }

  const cancellationNum = parseFloat(cancellation) || 0;

  return tierBonus + monthlySalary + commission - cancellationNum;
}

function formatCurrency(amount: string | number) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num || 0);
}

export function SalaryTable({ reps, tiers, month, year, canEdit }: SalaryTableProps) {
  const [salaries, setSalaries] = React.useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const rep of reps) {
      map[rep.id] = rep.salary;
    }
    return map;
  });
  const [cancellations, setCancellations] = React.useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const rep of reps) {
      map[rep.id] = rep.cancellationDeduction;
    }
    return map;
  });
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [copying, setCopying] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pendingChanges, setPendingChanges] = React.useState<PendingChange[]>([]);

  const getChanges = (): PendingChange[] => {
    const changes: PendingChange[] = [];
    for (const rep of reps) {
      const origSalary = rep.salary;
      const currSalary = salaries[rep.id] ?? "0";
      if ((parseFloat(currSalary) || 0) !== (parseFloat(origSalary) || 0)) {
        changes.push({
          repId: rep.id,
          repName: `${rep.firstName} ${rep.lastName}`,
          field: "salary",
          oldValue: origSalary,
          newValue: currSalary,
        });
      }

      const origCancel = rep.cancellationDeduction;
      const currCancel = cancellations[rep.id] ?? "0";
      if ((parseFloat(currCancel) || 0) !== (parseFloat(origCancel) || 0)) {
        changes.push({
          repId: rep.id,
          repName: `${rep.firstName} ${rep.lastName}`,
          field: "cancellationDeduction",
          oldValue: origCancel,
          newValue: currCancel,
        });
      }
    }
    return changes;
  };

  const handleSaveClick = () => {
    const changes = getChanges();
    if (changes.length === 0) return;
    setPendingChanges(changes);
    setConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    setConfirmOpen(false);
    setSaving(true);

    // Group changes by rep so we send one request per rep
    const changedRepIds = [...new Set(pendingChanges.map((c) => c.repId))];

    try {
      await Promise.all(
        changedRepIds.map((repId) =>
          fetch("/api/pay/plans", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              salesRepId: repId,
              month,
              year,
              salary: parseFloat(salaries[repId]) || 0,
              cancellationDeduction: parseFloat(cancellations[repId]) || 0,
            }),
          })
        )
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyFromPreviousMonth = async () => {
    setCopying(true);
    try {
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const res = await fetch(`/api/pay/plans?month=${prevMonth}&year=${prevYear}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const prevSalaries: Record<string, string> = {};
        for (const rep of json.data) {
          const salary = rep.salary ?? rep.payPlan?.salary;
          if (salary !== undefined && salary !== null) {
            prevSalaries[rep.id] = String(salary);
          }
        }
        setSalaries((prev) => {
          const updated = { ...prev };
          for (const rep of reps) {
            if (prevSalaries[rep.id] !== undefined) {
              updated[rep.id] = prevSalaries[rep.id];
            }
          }
          return updated;
        });
      }
    } catch (error) {
      console.error("Failed to fetch previous month:", error);
    } finally {
      setCopying(false);
    }
  };

  const hasChanges = React.useMemo(() => getChanges().length > 0, [salaries, cancellations, reps]);

  if (reps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No sales reps assigned to this office.
      </p>
    );
  }

  const saveButton = (
    <Button
      onClick={handleSaveClick}
      disabled={saving || !hasChanges}
      className="h-8"
      size="sm"
    >
      {saving ? "Saving..." : saved ? "Saved!" : "Save All Changes"}
    </Button>
  );

  return (
    <>
      <div className="overflow-x-auto">
        {canEdit && (
          <div className="flex justify-end gap-2 mb-3">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={handleCopyFromPreviousMonth}
              disabled={copying}
            >
              {copying ? "Copying..." : "Copy Salary from Previous Month"}
            </Button>
            {saveButton}
          </div>
        )}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Buildings Sold</th>
              <th className="pb-2 font-medium">Bonus</th>
              <th className="pb-2 font-medium">Total Sales</th>
              <th className="pb-2 font-medium">Salary</th>
              <th className="pb-2 font-medium">Cancellations</th>
              <th className="pb-2 font-medium">Calculated Pay</th>
            </tr>
          </thead>
          <tbody>
            {reps.map((rep) => {
              const bonus = calculateTierBonus(rep.buildingsSold, tiers);
              const pay = calculatePay(
                rep.buildingsSold,
                rep.totalOrderAmount,
                salaries[rep.id] ?? "0",
                cancellations[rep.id] ?? "0",
                tiers
              );

              return (
                <tr key={rep.id} className="border-b last:border-0">
                  <td className="py-2 font-medium">
                    {rep.firstName} {rep.lastName}
                  </td>
                  <td className="py-2">{rep.buildingsSold}</td>
                  <td className="py-2">{formatCurrency(bonus)}</td>
                  <td className="py-2">{formatCurrency(rep.totalOrderAmount)}</td>
                  <td className="py-2">
                    {canEdit ? (
                      <div className="relative w-36">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                          $
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          value={salaries[rep.id] ?? ""}
                          onChange={(e) =>
                            setSalaries((prev) => ({
                              ...prev,
                              [rep.id]: e.target.value,
                            }))
                          }
                          className="pl-7 h-8"
                        />
                      </div>
                    ) : (
                      formatCurrency(salaries[rep.id] ?? "0")
                    )}
                  </td>
                  <td className="py-2">
                    {canEdit ? (
                      <div className="relative w-36">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                          $
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          value={cancellations[rep.id] ?? ""}
                          onChange={(e) =>
                            setCancellations((prev) => ({
                              ...prev,
                              [rep.id]: e.target.value,
                            }))
                          }
                          className="pl-7 h-8"
                        />
                      </div>
                    ) : (
                      formatCurrency(cancellations[rep.id] ?? "0")
                    )}
                  </td>
                  <td className="py-2 font-medium">
                    {formatCurrency(pay)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {canEdit && (
          <div className="flex justify-end gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={handleCopyFromPreviousMonth}
              disabled={copying}
            >
              {copying ? "Copying..." : "Copy Salary from Previous Month"}
            </Button>
            {saveButton}
          </div>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Changes</DialogTitle>
            <DialogDescription>
              Are the following changes correct?
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Field</th>
                  <th className="pb-2 pr-4 font-medium">Old</th>
                  <th className="pb-2 font-medium">New</th>
                </tr>
              </thead>
              <tbody>
                {pendingChanges.map((change, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{change.repName}</td>
                    <td className="py-2 pr-4">
                      {change.field === "salary" ? "Salary" : "Cancellations"}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {formatCurrency(change.oldValue)}
                    </td>
                    <td className="py-2 font-medium">
                      {formatCurrency(change.newValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              No, Cancel
            </Button>
            <Button onClick={handleConfirmSave}>
              Yes, Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
