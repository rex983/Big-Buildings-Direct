"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import type { OrderStage } from "@prisma/client";

interface OrderStageAdvanceProps {
  orderId: string;
  currentStageId: string | null;
  stages: OrderStage[];
}

export function OrderStageAdvance({ orderId, currentStageId, stages }: OrderStageAdvanceProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState("");
  const [notes, setNotes] = useState("");

  const currentIndex = stages.findIndex((s) => s.id === currentStageId);
  const nextStages = stages.filter((_, index) => index > currentIndex);

  const handleAdvance = async () => {
    if (!selectedStageId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stageId: selectedStageId,
          notes: notes || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to advance stage");
      }

      addToast({
        title: "Stage updated",
        description: "Order has been moved to the next stage.",
        variant: "success",
      });

      setOpen(false);
      setSelectedStageId("");
      setNotes("");
      router.refresh();
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to advance stage",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (nextStages.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Advance Stage</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Advance Order Stage</DialogTitle>
          <DialogDescription>
            Move this order to the next stage in the workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="stage">Select Next Stage</Label>
            <Select
              id="stage"
              value={selectedStageId}
              onChange={(e) => setSelectedStageId(e.target.value)}
            >
              <option value="">Select a stage...</option>
              {nextStages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this stage transition..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdvance} loading={loading} disabled={!selectedStageId}>
            Advance Stage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
