"use client";

import * as React from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface DrilldownData {
  totalSales: number;
  totalOrderAmount: number;
  totalDeposits: number;
  totalRevisions: number;
}

interface DrilldownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterType: "salesRep" | "state" | "manufacturer";
  filterValue: string;
  startDate?: string;
  endDate?: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

const typeLabels: Record<string, string> = {
  salesRep: "Sales Rep",
  state: "State",
  manufacturer: "Manufacturer",
};

function getDetailUrl(filterType: string, filterValue: string): string {
  const encoded = encodeURIComponent(filterValue);
  if (filterType === "salesRep") return `/sales-rep/${encoded}`;
  if (filterType === "manufacturer") return `/manufacturer/${encoded}`;
  if (filterType === "state") return `/state/${encoded}`;
  return "/dashboard";
}

function StatCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {subtext && (
          <p className="text-xs text-muted-foreground mt-1">{subtext}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function DrilldownDialog({
  open,
  onOpenChange,
  filterType,
  filterValue,
  startDate,
  endDate,
}: DrilldownDialogProps) {
  const [data, setData] = React.useState<DrilldownData | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open || !filterValue) return;

    const fetchData = async () => {
      setLoading(true);
      setData(null);
      try {
        const params = new URLSearchParams({
          type: filterType,
          value: filterValue,
        });
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);

        const res = await fetch(`/api/dashboard/drilldown?${params.toString()}`);
        const result = await res.json();
        if (result.success) {
          setData(result.data);
        }
      } catch (error) {
        console.error("Failed to fetch drilldown:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, filterType, filterValue, startDate, endDate]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {typeLabels[filterType]}: {filterValue}
          </DialogTitle>
          <DialogDescription>
            {startDate || endDate
              ? `${startDate ? new Date(startDate).toLocaleDateString() : "All time"} — ${endDate ? new Date(endDate).toLocaleDateString() : "Present"}`
              : "All time"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="h-4 bg-muted rounded animate-pulse w-20 mb-2" />
                  <div className="h-8 bg-muted rounded animate-pulse w-28" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <StatCard
                label="Total Sales"
                value={data.totalSales.toLocaleString()}
                subtext="Orders (excl. cancelled)"
              />
              <StatCard
                label="Total Order Amount"
                value={formatCurrency(data.totalOrderAmount)}
              />
              <StatCard
                label="Total Deposits"
                value={formatCurrency(data.totalDeposits)}
                subtext="Collected deposits"
              />
              <StatCard
                label="Total Revisions"
                value={data.totalRevisions.toLocaleString()}
              />
            </div>
            <div className="flex justify-end mt-2">
              <Link href={getDetailUrl(filterType, filterValue)}>
                <Button variant="outline" size="sm">
                  View Full Details →
                </Button>
              </Link>
            </div>
          </>
        ) : (
          <p className="text-center text-muted-foreground py-8">No data found.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
