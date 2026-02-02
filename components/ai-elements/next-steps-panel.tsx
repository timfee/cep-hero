"use client";

import { ArrowRight } from "lucide-react";
import { memo } from "react";

import { cn } from "@/lib/utils";

export interface NextStepsPanelProps {
  steps: string[];
  className?: string;
  onStepClick?: (step: string) => void;
}

export const NextStepsPanel = memo(function NextStepsPanel({
  steps,
  className,
  onStepClick,
}: NextStepsPanelProps) {
  if (steps.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-medium text-muted-foreground">Next steps</p>
      <div className="space-y-1">
        {steps.map((step, i) => (
          <button
            key={i}
            onClick={() => onStepClick?.(step)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted/50"
          >
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span>{step}</span>
          </button>
        ))}
      </div>
    </div>
  );
});
