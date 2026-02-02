"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { Lightbulb } from "lucide-react";
import type { ComponentProps } from "react";
import type { Hypothesis as HypothesisType } from "@/types/chat";

export type HypothesisCardProps = ComponentProps<"div"> & {
  hypothesis: HypothesisType;
  index?: number;
};

export function HypothesisCard({
  hypothesis,
  index = 0,
  className,
  ...props
}: HypothesisCardProps) {
  const confidencePercent = Math.round((hypothesis.confidence ?? 0) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn("space-y-2", className)}
      {...props}
    >
      <div className="flex items-start gap-2">
        <Lightbulb className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
        <p className="text-xs text-foreground">{hypothesis.cause}</p>
      </div>
      <div className="ml-5 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <motion.div
            className={cn(
              "h-full rounded-full",
              confidencePercent >= 70
                ? "bg-status-positive"
                : confidencePercent >= 40
                  ? "bg-status-warning"
                  : "bg-muted-foreground"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${confidencePercent}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {confidencePercent}%
        </span>
      </div>
      {hypothesis.evidence && hypothesis.evidence.length > 0 && (
        <ul className="ml-5 space-y-1">
          {hypothesis.evidence.map((ev, i) => (
            <li
              key={i}
              className="text-xs text-muted-foreground before:mr-1.5 before:content-['-']"
            >
              {ev}
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}

export type HypothesesListProps = ComponentProps<"div"> & {
  hypotheses: HypothesisType[];
  maxItems?: number;
};

export function HypothesesList({
  hypotheses,
  maxItems = 3,
  className,
  ...props
}: HypothesesListProps) {
  if (!hypotheses?.length) return null;

  return (
    <div className={cn("space-y-3", className)} {...props}>
      {hypotheses.slice(0, maxItems).map((h, i) => (
        <HypothesisCard key={i} hypothesis={h} index={i} />
      ))}
    </div>
  );
}
