"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface PayTabsProps {
  planContent: React.ReactNode;
  ledgerContent: React.ReactNode;
  activityContent: React.ReactNode;
  defaultTab?: string;
  showLedgerTab: boolean;
  month: number;
  year: number;
}

export function PayTabs({
  planContent,
  ledgerContent,
  activityContent,
  defaultTab = "plan",
  showLedgerTab,
  month,
  year,
}: PayTabsProps) {
  const router = useRouter();

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams();
    params.set("tab", value);
    params.set("month", String(month));
    params.set("year", String(year));
    router.push(`/pay?${params.toString()}`);
  };

  return (
    <Tabs defaultValue={defaultTab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="plan">Pay Plans</TabsTrigger>
        {showLedgerTab && (
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
        )}
        <TabsTrigger value="activity">Activity Log</TabsTrigger>
      </TabsList>
      <TabsContent value="plan">
        {planContent}
      </TabsContent>
      {showLedgerTab && (
        <TabsContent value="ledger">
          {ledgerContent}
        </TabsContent>
      )}
      <TabsContent value="activity">
        {activityContent}
      </TabsContent>
    </Tabs>
  );
}
