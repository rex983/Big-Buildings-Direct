"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SalaryRep {
  id: string;
  firstName: string;
  lastName: string;
  salary: string;
  buildingsSold: number;
  totalOrderAmount: string;
}

interface SalaryTableProps {
  reps: SalaryRep[];
  month: number;
  year: number;
  canEdit: boolean;
}

export function SalaryTable({ reps, month, year, canEdit }: SalaryTableProps) {
  const [salaries, setSalaries] = React.useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const rep of reps) {
      map[rep.id] = rep.salary;
    }
    return map;
  });
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [savedId, setSavedId] = React.useState<string | null>(null);

  const handleSave = async (repId: string) => {
    setSavingId(repId);
    try {
      const res = await fetch("/api/pay/plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesRepId: repId,
          month,
          year,
          salary: parseFloat(salaries[repId]) || 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSavedId(repId);
        setTimeout(() => setSavedId(null), 2000);
      }
    } catch (error) {
      console.error("Failed to save salary:", error);
    } finally {
      setSavingId(null);
    }
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num || 0);
  };

  if (reps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No sales reps assigned to this office.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 font-medium">Name</th>
            <th className="pb-2 font-medium">Buildings Sold</th>
            <th className="pb-2 font-medium">Total Sales</th>
            <th className="pb-2 font-medium">Salary</th>
            {canEdit && <th className="pb-2 font-medium w-24"></th>}
          </tr>
        </thead>
        <tbody>
          {reps.map((rep) => (
            <tr key={rep.id} className="border-b last:border-0">
              <td className="py-2 font-medium">
                {rep.firstName} {rep.lastName}
              </td>
              <td className="py-2">{rep.buildingsSold}</td>
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
              {canEdit && (
                <td className="py-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => handleSave(rep.id)}
                    disabled={savingId === rep.id}
                  >
                    {savingId === rep.id
                      ? "Saving..."
                      : savedId === rep.id
                        ? "Saved!"
                        : "Save"}
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
