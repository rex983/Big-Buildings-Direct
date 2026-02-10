"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LineItem {
  name: string;
  amount: string;
}

interface PayPlanCardProps {
  salesRep: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  orderStats: {
    buildingsSold: number;
    totalOrderAmount: string | number;
  };
  initialLineItems: LineItem[];
  month: number;
  year: number;
  canEdit: boolean;
}

export function PayPlanCard({
  salesRep,
  orderStats,
  initialLineItems,
  month,
  year,
  canEdit,
}: PayPlanCardProps) {
  const [lineItems, setLineItems] = React.useState<LineItem[]>(
    initialLineItems.length > 0 ? initialLineItems : []
  );
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const total = lineItems.reduce((sum, item) => {
    const amount = parseFloat(item.amount) || 0;
    return sum + amount;
  }, 0);

  const addLineItem = () => {
    setLineItems([...lineItems, { name: "", amount: "" }]);
    setSaved(false);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
    setSaved(false);
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/pay/plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesRepId: salesRep.id,
          month,
          year,
          lineItems: lineItems
            .filter((item) => item.name.trim())
            .map((item) => ({
              name: item.name,
              amount: parseFloat(item.amount) || 0,
            })),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (error) {
      console.error("Failed to save pay plan:", error);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num || 0);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {salesRep.firstName} {salesRep.lastName}
          </CardTitle>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              Buildings Sold: <strong className="text-foreground">{orderStats.buildingsSold}</strong>
            </span>
            <span>
              Total Sales: <strong className="text-foreground">{formatCurrency(orderStats.totalOrderAmount)}</strong>
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {lineItems.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              placeholder="Line item name"
              value={item.name}
              onChange={(e) => updateLineItem(index, "name", e.target.value)}
              className="flex-1"
              disabled={!canEdit}
            />
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                type="number"
                placeholder="0.00"
                value={item.amount}
                onChange={(e) => updateLineItem(index, "amount", e.target.value)}
                className="w-32 pl-7"
                step="0.01"
                disabled={!canEdit}
              />
            </div>
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeLineItem(index)}
                className="text-destructive hover:text-destructive"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            )}
          </div>
        ))}

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button variant="outline" size="sm" onClick={addLineItem}>
                <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Line Item
              </Button>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">
              Total: <strong className="text-lg">{formatCurrency(total)}</strong>
            </span>
            {canEdit && (
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving ? "Saving..." : saved ? "Saved!" : "Save Plan"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
