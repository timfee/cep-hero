"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { CheckCircle2, ListChecks, ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useState, memo } from "react";

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
  title = "What I checked",
}: PlanStepsProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (steps.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          "rounded-lg border border-border bg-card overflow-hidden",
          className
        )}
      >
        <CollapsibleTrigger className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/50">
          <ListChecks className="h-4 w-4 shrink-0 text-status-positive" />
          <span className="flex-1 text-sm font-medium text-foreground">
            {title}
          </span>
          <Badge variant="secondary" className="text-xs">
            {steps.length}
          </Badge>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </motion.div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="border-t border-border p-3"
          >
            <ul className="space-y-2">
              {steps.map((step, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-2"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-positive" />
                  <span className="text-sm text-foreground">{step}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </CollapsibleContent>
      </motion.div>
    </Collapsible>
  );
});
