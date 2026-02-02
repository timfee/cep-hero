"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { memo, useState } from "react";

import { cn } from "@/lib/utils";

export interface NextStepsPanelProps {
  steps: string[];
  className?: string;
  onStepClick?: (step: string) => void;
  disabled?: boolean;
}

export const NextStepsPanel = memo(function NextStepsPanel({
  steps,
  className,
  onStepClick,
  disabled,
}: NextStepsPanelProps) {
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);

  if (steps.length === 0) return null;

  const handleClick = (step: string, idx: number) => {
    if (disabled || loadingIdx !== null) return;
    setLoadingIdx(idx);
    onStepClick?.(step);
    setTimeout(() => setLoadingIdx(null), 1500);
  };

  return (
    <div className={cn("space-y-2 lg:space-y-3", className)}>
      <p className="text-xs font-medium text-muted-foreground">Next steps</p>
      <div className="space-y-1">
        {steps.map((step, i) => {
          const isLoading = loadingIdx === i;
          const isDisabled = disabled || (loadingIdx !== null && !isLoading);
          
          return (
            <button
              key={i}
              onClick={() => handleClick(step, i)}
              disabled={isDisabled}
              aria-busy={isLoading}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-all hover:bg-muted/50 active:scale-[0.99] lg:px-3 lg:py-2",
                isDisabled && "pointer-events-none opacity-50",
                isLoading && "cursor-wait bg-muted/30"
              )}
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
              <span>{step}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
