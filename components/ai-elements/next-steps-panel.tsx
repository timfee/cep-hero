"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { memo } from "react";

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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn("space-y-2", className)}
    >
      <div className="flex items-center gap-2">
        <ArrowRight className="h-4 w-4 text-primary" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Recommended next steps
        </span>
        <Badge variant="secondary" className="text-xs">
          {steps.length}
        </Badge>
      </div>

      <div className="space-y-1.5">
        {steps.map((step, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 transition-colors hover:bg-muted/50"
          >
            <span className="flex-1 text-sm text-foreground">{step}</span>
            {onStepClick && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={() => onStepClick(step)}
              >
                <Play className="h-3 w-3" />
                Run
              </Button>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
});
