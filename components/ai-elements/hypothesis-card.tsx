"use client";

import { cn } from "@/lib/utils";
import { Lightbulb, ChevronDown, Check } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-foreground/30"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {percent}%
      </span>
    </div>
  );
}

export const HypothesisCard = memo(function HypothesisCard({
  hypothesis,
  className,
}: HypothesisCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasEvidence = hypothesis.evidence && hypothesis.evidence.length > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          "rounded-md border border-border overflow-hidden",
          className
        )}
      >
        <CollapsibleTrigger className="flex w-full items-start gap-2 p-3 text-left transition-colors hover:bg-muted/30">
          <Lightbulb className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm text-foreground leading-snug">
              {hypothesis.cause}
            </p>
            <ConfidenceBar confidence={hypothesis.confidence} />
          </div>
          {hasEvidence && (
            <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform mt-0.5", isOpen && "rotate-180")} />
          )}
        </CollapsibleTrigger>

        {hasEvidence && (
          <CollapsibleContent>
            <div className="border-t border-border px-3 py-2">
              <p className="mb-1.5 text-xs text-muted-foreground">Evidence</p>
              <ul className="space-y-1">
                {hypothesis.evidence!.map((ev, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs text-foreground"
                  >
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                    <span>{ev}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CollapsibleContent>
        )}
      </div>
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
      <p className="text-xs font-medium text-muted-foreground">
        Possible causes ({hypotheses.length})
      </p>
      <div className="space-y-2">
        {visible.map((h, i) => (
          <HypothesisCard key={i} hypothesis={h} rank={i} />
        ))}
      </div>
      {!showAll && hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Show {hiddenCount} more
        </button>
      )}
    </div>
  );
});
