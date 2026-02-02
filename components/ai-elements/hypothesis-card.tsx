"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { Lightbulb, ChevronDown, CheckCircle2 } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import type { Hypothesis } from "@/types/chat";
import { useState, memo } from "react";

export interface HypothesisCardProps {
  hypothesis: Hypothesis;
  className?: string;
  rank?: number;
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100);

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <motion.div
          className={cn(
            "h-full rounded-full",
            percent >= 70
              ? "bg-status-positive"
              : percent >= 40
                ? "bg-status-warning"
                : "bg-muted-foreground"
          )}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs tabular-nums font-medium text-muted-foreground">
        {percent}%
      </span>
    </div>
  );
}

export const HypothesisCard = memo(function HypothesisCard({
  hypothesis,
  className,
  rank,
}: HypothesisCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasEvidence = hypothesis.evidence && hypothesis.evidence.length > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: rank ? rank * 0.1 : 0 }}
        className={cn(
          "rounded-lg border border-border bg-card overflow-hidden",
          className
        )}
      >
        <CollapsibleTrigger className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/50">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm text-foreground leading-snug">
              {hypothesis.cause}
            </p>
            <ConfidenceBar confidence={hypothesis.confidence} />
          </div>
          {hasEvidence && (
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="shrink-0 mt-0.5"
            >
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </motion.div>
          )}
        </CollapsibleTrigger>

        {hasEvidence && (
          <CollapsibleContent>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="border-t border-border bg-muted/30 px-3 py-2"
            >
              <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Supporting evidence
              </p>
              <ul className="space-y-1.5">
                {hypothesis.evidence!.map((ev, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-2 text-xs text-foreground"
                  >
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-status-positive" />
                    <span>{ev}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </CollapsibleContent>
        )}
      </motion.div>
    </Collapsible>
  );
});

export interface HypothesesListProps {
  hypotheses: Hypothesis[];
  className?: string;
  maxVisible?: number;
}

export const HypothesesList = memo(function HypothesesList({
  hypotheses,
  className,
  maxVisible = 3,
}: HypothesesListProps) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? hypotheses : hypotheses.slice(0, maxVisible);
  const hiddenCount = hypotheses.length - maxVisible;

  if (hypotheses.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Hypotheses
        </span>
        <Badge variant="secondary" className="text-xs">
          {hypotheses.length}
        </Badge>
      </div>
      <div className="space-y-2">
        {visible.map((h, i) => (
          <HypothesisCard key={i} hypothesis={h} rank={i} />
        ))}
      </div>
      {!showAll && hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="text-xs text-primary hover:underline"
        >
          Show {hiddenCount} more
        </button>
      )}
    </div>
  );
});
