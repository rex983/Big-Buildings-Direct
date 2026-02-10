"use client";

import { cn } from "@/lib/utils";
import type { OrderStage } from "@prisma/client";

interface StageHistory {
  id: string;
  stageId: string;
  createdAt: Date;
  stage: OrderStage;
}

interface OrderTimelineProps {
  stages: OrderStage[];
  currentStageId: string | null;
  stageHistory: StageHistory[];
}

export function OrderTimeline({ stages, currentStageId, stageHistory }: OrderTimelineProps) {
  const completedStageIds = new Set(stageHistory.map((h) => h.stageId));
  const currentIndex = stages.findIndex((s) => s.id === currentStageId);

  return (
    <div className="relative">
      <div className="flex items-center justify-between">
        {stages.map((stage, index) => {
          const isCompleted = completedStageIds.has(stage.id) && index < currentIndex;
          const isCurrent = stage.id === currentStageId;
          const isPending = index > currentIndex;

          return (
            <div key={stage.id} className="flex flex-col items-center flex-1">
              {/* Connector line */}
              {index > 0 && (
                <div
                  className={cn(
                    "absolute h-0.5 -translate-y-1/2",
                    isCompleted || isCurrent ? "bg-primary" : "bg-muted"
                  )}
                  style={{
                    left: `${((index - 1) / (stages.length - 1)) * 100 + 50 / stages.length}%`,
                    width: `${100 / stages.length - 100 / stages.length / 2}%`,
                    top: "20px",
                  }}
                />
              )}

              {/* Stage indicator */}
              <div
                className={cn(
                  "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-medium",
                  isCompleted && "border-primary bg-primary text-primary-foreground",
                  isCurrent && "border-primary bg-background",
                  isPending && "border-muted bg-muted text-muted-foreground"
                )}
                style={isCurrent ? { borderColor: stage.color } : undefined}
              >
                {isCompleted ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>

              {/* Stage name */}
              <span
                className={cn(
                  "mt-2 text-xs text-center max-w-[80px]",
                  isCurrent && "font-medium",
                  isPending && "text-muted-foreground"
                )}
                style={isCurrent ? { color: stage.color } : undefined}
              >
                {stage.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
