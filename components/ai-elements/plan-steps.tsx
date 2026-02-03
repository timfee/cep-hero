"use client";

import { Check, ChevronDown } from "lucide-react";
import { useState, memo } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface PlanStepsProps {
  steps: string[];
  className?: string;
  defaultOpen?: boolean;
  title?: string;
}

export const PlanSteps = memo(function PlanSteps({
  steps,
  className,
  defaultOpen = false,
  title = "Steps completed",
}: PlanStepsProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (steps.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          "rounded-md border border-border overflow-hidden",
          className
        )}
      >
        <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/30">
          <span className="flex-1 text-xs text-muted-foreground">
            {title} ({steps.length})
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border px-3 py-2">
            <ul className="space-y-1">
              {steps.map((step, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-foreground"
                >
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
});
