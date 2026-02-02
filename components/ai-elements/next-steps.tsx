"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { ArrowRight, ChevronDown, ListTodo } from "lucide-react";
import type { ComponentProps } from "react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type NextStepItemProps = {
  step: string;
  index?: number;
  onRun?: (step: string) => void;
};

export function NextStepItem({ step, index = 0, onRun }: NextStepItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -5 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-center gap-2">
        <ArrowRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
        <span className="text-xs text-foreground">{step}</span>
      </div>
      {onRun && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={() => onRun(step)}
        >
          Run
        </Button>
      )}
    </motion.div>
  );
}

export type NextStepsPanelProps = ComponentProps<"div"> & {
  steps: string[];
  defaultOpen?: boolean;
  onRunStep?: (step: string) => void;
};

export function NextStepsPanel({
  steps,
  defaultOpen = true,
  onRunStep,
  className,
  ...props
}: NextStepsPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (!steps?.length) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-left transition-colors hover:bg-muted/50",
          className
        )}
        {...props}
      >
        <ListTodo className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 text-xs font-medium text-foreground">
          Recommended next steps
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
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-2 rounded-lg border border-border bg-muted/30 p-2"
        >
          {steps.map((step, i) => (
            <NextStepItem key={i} step={step} index={i} onRun={onRunStep} />
          ))}
        </motion.div>
      </CollapsibleContent>
    </Collapsible>
  );
}
