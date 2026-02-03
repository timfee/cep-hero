"use client";

import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronDown,
  FileSearch,
  AlertTriangle,
  Link2,
} from "lucide-react";
import { useState, memo } from "react";

import type { EvidencePayload } from "@/types/chat";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface EvidenceCheckProps {
  check: NonNullable<EvidencePayload["checks"]>[number];
  index?: number;
}

const statusConfig = {
  pass: {
    icon: CheckCircle2,
    color: "text-foreground/70",
  },
  fail: {
    icon: XCircle,
    color: "text-foreground/70",
  },
  unknown: {
    icon: HelpCircle,
    color: "text-muted-foreground",
  },
};

export const EvidenceCheck = memo(function EvidenceCheck({
  check,
}: EvidenceCheckProps) {
  const config = statusConfig[check.status];
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-2 py-1">
      <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", config.color)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{check.name}</p>
        {check.detail && (
          <p className="text-xs text-muted-foreground">{check.detail}</p>
        )}
      </div>
    </div>
  );
});

export interface EvidenceGapProps {
  gap: NonNullable<EvidencePayload["gaps"]>[number];
  index?: number;
}

export const EvidenceGap = memo(function EvidenceGap({
  gap,
}: EvidenceGapProps) {
  return (
    <div className="flex items-start gap-2 py-1">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{gap.missing}</p>
        <p className="text-xs text-muted-foreground">{gap.why}</p>
      </div>
    </div>
  );
});

export interface EvidenceSignalProps {
  signal: NonNullable<EvidencePayload["signals"]>[number];
  index?: number;
}

export const EvidenceSignal = memo(function EvidenceSignal({
  signal,
}: EvidenceSignalProps) {
  return (
    <div className="rounded-md border border-border p-2">
      <div className="flex items-center gap-2">
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          {signal.type}
        </span>
        <span className="text-xs text-muted-foreground">{signal.source}</span>
      </div>
      <p className="mt-1 text-sm text-foreground">{signal.summary}</p>
      {signal.referenceUrl && (
        <a
          href={signal.referenceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Link2 className="h-3 w-3" />
          Reference
        </a>
      )}
    </div>
  );
});

export interface EvidencePanelProps {
  evidence: EvidencePayload;
  className?: string;
  defaultOpen?: boolean;
}

export const EvidencePanel = memo(function EvidencePanel({
  evidence,
  className,
  defaultOpen = false,
}: EvidencePanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const checksCount = evidence.checks?.length ?? 0;
  const gapsCount = evidence.gaps?.length ?? 0;
  const signalsCount = evidence.signals?.length ?? 0;
  const totalCount = checksCount + gapsCount + signalsCount;

  if (totalCount === 0) {
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
          <FileSearch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-xs text-muted-foreground">
            Evidence ({checksCount} checks)
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border p-3 space-y-4">
            {/* Checks */}
            {evidence.checks && evidence.checks.length > 0 && (
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Checks</p>
                <div className="space-y-1">
                  {evidence.checks.map((check, i) => (
                    <EvidenceCheck key={i} check={check} index={i} />
                  ))}
                </div>
              </div>
            )}

            {/* Gaps */}
            {evidence.gaps && evidence.gaps.length > 0 && (
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Gaps</p>
                <div className="space-y-1">
                  {evidence.gaps.map((gap, i) => (
                    <EvidenceGap key={i} gap={gap} index={i} />
                  ))}
                </div>
              </div>
            )}

            {/* Signals */}
            {evidence.signals && evidence.signals.length > 0 && (
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Signals</p>
                <div className="space-y-2">
                  {evidence.signals.map((signal, i) => (
                    <EvidenceSignal key={i} signal={signal} index={i} />
                  ))}
                </div>
              </div>
            )}

            {/* Sources */}
            {evidence.sources && evidence.sources.length > 0 && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Sources: {evidence.sources.join(", ")}
                </p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
});
