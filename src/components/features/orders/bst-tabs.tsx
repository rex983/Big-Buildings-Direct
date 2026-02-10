"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface TabCounts {
  pipeline: number;
  tickets: number;
  revisions: number;
  cancellations: number;
}

interface BstTabsProps {
  pipelineContent: React.ReactNode;
  ticketsContent: React.ReactNode;
  revisionsContent: React.ReactNode;
  cancellationsContent: React.ReactNode;
  defaultTab?: string;
  tabCounts?: TabCounts;
}

export function BstTabs({
  pipelineContent,
  ticketsContent,
  revisionsContent,
  cancellationsContent,
  defaultTab = "pipeline",
  tabCounts,
}: BstTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams();
    if (value !== "pipeline") {
      params.set("tab", value);
    }
    const query = params.toString();
    router.push(`/success-team${query ? `?${query}` : ""}`);
  };

  return (
    <Tabs defaultValue={defaultTab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="pipeline">
          Pipeline{tabCounts ? ` (${tabCounts.pipeline})` : ""}
        </TabsTrigger>
        <TabsTrigger value="tickets">
          Tickets{tabCounts ? ` (${tabCounts.tickets})` : ""}
        </TabsTrigger>
        <TabsTrigger value="revisions">
          Revisions{tabCounts ? ` (${tabCounts.revisions})` : ""}
        </TabsTrigger>
        <TabsTrigger value="cancellations">
          Cancellations{tabCounts ? ` (${tabCounts.cancellations})` : ""}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="pipeline">
        {pipelineContent}
      </TabsContent>
      <TabsContent value="tickets">
        {ticketsContent}
      </TabsContent>
      <TabsContent value="revisions">
        {revisionsContent}
      </TabsContent>
      <TabsContent value="cancellations">
        {cancellationsContent}
      </TabsContent>
    </Tabs>
  );
}
