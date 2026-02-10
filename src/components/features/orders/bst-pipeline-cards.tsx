import Link from "next/link";

export interface BstStageCounts {
  stmPending: number;      // Stage 1: wcStatus = null
  wcPending: number;       // Stage 2: wcStatus = "Pending"
  noContactMade: number;   // Stage 3: wcStatus = "No Contact Made"
  wcDoneLpp: number;       // Stage 4: wcStatus = "Contact Made", lppStatus = null or "Pending"
  readyToInstall: number;  // Stage 5: wcStatus = "Contact Made", lppStatus = "Ready for Install"
}

interface BstPipelineCardsProps {
  counts: BstStageCounts;
  activeStage?: string;
  baseUrl?: string;
}

const stages = [
  {
    key: "stmPending",
    label: "STM Pending",
    description: "Sent to manufacturer, BST hasn't touched",
    color: "bg-slate-100 text-slate-700 border-slate-300",
    activeColor: "bg-slate-600 text-white border-slate-700",
    textColor: "text-slate-600",
  },
  {
    key: "wcPending",
    label: "WC Pending",
    description: "BST acknowledged, starting outreach",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    activeColor: "bg-blue-600 text-white border-blue-700",
    textColor: "text-blue-600",
  },
  {
    key: "noContactMade",
    label: "No Contact Made",
    description: "Attempted contact, no response",
    color: "bg-orange-50 text-orange-700 border-orange-200",
    activeColor: "bg-orange-500 text-white border-orange-600",
    textColor: "text-orange-600",
  },
  {
    key: "wcDoneLpp",
    label: "WC Done, LP&P",
    description: "Contact made, awaiting site prep",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    activeColor: "bg-amber-500 text-white border-amber-600",
    textColor: "text-amber-600",
  },
  {
    key: "readyToInstall",
    label: "Ready to Install",
    description: "Site ready for installation",
    color: "bg-green-50 text-green-700 border-green-200",
    activeColor: "bg-green-600 text-white border-green-700",
    textColor: "text-green-600",
  },
] as const;

export function BstPipelineCards({
  counts,
  activeStage,
  baseUrl = "/success-team",
}: BstPipelineCardsProps) {
  const total = counts.stmPending + counts.wcPending + counts.noContactMade + counts.wcDoneLpp + counts.readyToInstall;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">BST Pipeline</h3>
        <span className="text-sm text-muted-foreground">{total} total orders</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {stages.map((stage, index) => {
          const count = counts[stage.key as keyof BstStageCounts];
          const isActive = activeStage === stage.key;
          const href = isActive
            ? baseUrl
            : `${baseUrl}?bstStage=${stage.key}`;

          return (
            <Link
              key={stage.key}
              href={href}
              className={`
                relative flex flex-col p-3 rounded-lg border-2 transition-all
                hover:shadow-md hover:scale-[1.02]
                ${isActive ? stage.activeColor : stage.color}
              `}
            >
              {/* Stage number indicator */}
              <span className={`
                absolute -top-2 -left-2 w-5 h-5 rounded-full text-xs font-bold
                flex items-center justify-center
                ${isActive ? "bg-white text-gray-800" : "bg-gray-800 text-white"}
              `}>
                {index + 1}
              </span>

              {/* Count */}
              <span className="text-2xl font-bold">{count}</span>

              {/* Label */}
              <span className="text-sm font-medium truncate">{stage.label}</span>

              {/* Active indicator */}
              {isActive && (
                <span className="absolute top-1 right-1 text-xs opacity-75">
                  (filtered)
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
