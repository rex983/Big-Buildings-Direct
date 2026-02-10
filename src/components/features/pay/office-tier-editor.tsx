"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Tier {
  type: "BUILDINGS_SOLD" | "ORDER_TOTAL";
  minValue: string;
  maxValue: string;
  bonusAmount: string;
  bonusType: "FLAT" | "PERCENTAGE";
}

interface OfficeTierEditorProps {
  office: string;
  month: number;
  year: number;
  initialTiers: Tier[];
  canEdit: boolean;
}

export function OfficeTierEditor({
  office,
  month,
  year,
  initialTiers,
  canEdit,
}: OfficeTierEditorProps) {
  const [tiers, setTiers] = React.useState<Tier[]>(initialTiers);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const buildingsTiers = tiers.filter((t) => t.type === "BUILDINGS_SOLD");
  const orderTiers = tiers.filter((t) => t.type === "ORDER_TOTAL");

  const addTier = (type: Tier["type"]) => {
    setTiers([...tiers, { type, minValue: "", maxValue: "", bonusAmount: "", bonusType: "FLAT" }]);
    setSaved(false);
  };

  const removeTier = (index: number) => {
    setTiers(tiers.filter((_, i) => i !== index));
    setSaved(false);
  };

  const updateTier = (
    globalIndex: number,
    field: keyof Tier,
    value: string
  ) => {
    const updated = [...tiers];
    updated[globalIndex] = { ...updated[globalIndex], [field]: value };
    setTiers(updated);
    setSaved(false);
  };

  const getGlobalIndex = (type: Tier["type"], localIndex: number) => {
    let count = 0;
    for (let i = 0; i < tiers.length; i++) {
      if (tiers[i].type === type) {
        if (count === localIndex) return i;
        count++;
      }
    }
    return -1;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/pay/office-plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          office,
          month,
          year,
          tiers: tiers
            .filter((t) => t.minValue !== "" && t.bonusAmount !== "")
            .map((t) => ({
              type: t.type,
              minValue: parseFloat(t.minValue) || 0,
              maxValue: t.maxValue === "" ? null : parseFloat(t.maxValue) || null,
              bonusAmount: parseFloat(t.bonusAmount) || 0,
              bonusType: t.bonusType,
            })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (error) {
      console.error("Failed to save office pay plan:", error);
    } finally {
      setSaving(false);
    }
  };

  const renderTierTable = (
    label: string,
    type: Tier["type"],
    items: Tier[],
    minLabel: string
  ) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{label}</h4>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => addTier(type)}
            className="h-7 text-xs"
          >
            <svg
              className="h-3 w-3 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Tier
          </Button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          No tiers configured.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-1 font-medium text-xs">{minLabel} Min</th>
              <th className="pb-1 font-medium text-xs">{minLabel} Max</th>
              <th className="pb-1 font-medium text-xs">
                {type === "BUILDINGS_SOLD" ? "Bonus (per bldg)" : "Bonus"}
              </th>
              <th className="pb-1 font-medium text-xs w-28">Type</th>
              {canEdit && <th className="pb-1 w-10"></th>}
            </tr>
          </thead>
          <tbody>
            {items.map((tier, localIndex) => {
              const globalIdx = getGlobalIndex(type, localIndex);
              return (
                <tr key={localIndex} className="border-b last:border-0">
                  <td className="py-1.5 pr-2">
                    <Input
                      type="number"
                      step={type === "ORDER_TOTAL" ? "0.01" : "1"}
                      value={tier.minValue}
                      onChange={(e) =>
                        updateTier(globalIdx, "minValue", e.target.value)
                      }
                      className="h-8"
                      disabled={!canEdit}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input
                      type="number"
                      step={type === "ORDER_TOTAL" ? "0.01" : "1"}
                      placeholder="Unlimited"
                      value={tier.maxValue}
                      onChange={(e) =>
                        updateTier(globalIdx, "maxValue", e.target.value)
                      }
                      className="h-8"
                      disabled={!canEdit}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                        {tier.bonusType === "PERCENTAGE" ? "%" : "$"}
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        value={tier.bonusAmount}
                        onChange={(e) =>
                          updateTier(globalIdx, "bonusAmount", e.target.value)
                        }
                        className="h-8 pl-6"
                        disabled={!canEdit}
                      />
                    </div>
                  </td>
                  <td className="py-1.5 pr-2">
                    <select
                      value={tier.bonusType}
                      onChange={(e) =>
                        updateTier(globalIdx, "bonusType", e.target.value)
                      }
                      disabled={!canEdit}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="FLAT">Flat $</option>
                      <option value="PERCENTAGE">% of Total</option>
                    </select>
                  </td>
                  {canEdit && (
                    <td className="py-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTier(globalIdx)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Pay Plan Variables</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderTierTable(
          "Buildings Sold Tiers",
          "BUILDINGS_SOLD",
          buildingsTiers,
          "Qty"
        )}
        <div className="border-t" />
        {renderTierTable(
          "Order Total Tiers",
          "ORDER_TOTAL",
          orderTiers,
          "Amount"
        )}
        {canEdit && (
          <div className="flex justify-end pt-2 border-t">
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? "Saving..." : saved ? "Saved!" : "Save Pay Plan"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
