"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronDown,
  FileSearch,
  AlertTriangle,
  Link2,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import type { EvidencePayload } from "@/types/chat";
import { useState, memo } from "react";

export interface EvidenceCheckProps {
  check: NonNullable<EvidencePayload["checks"]>[number];
  index?: number;
}

const statusConfig = {
  pass: {
    icon: CheckCircle2,
    color: "text-status-positive",
    bg: "bg-status-positive/10",
  },
  fail: {
    icon: XCircle,
    color: "text-destructive",
    bg: "bg-destructive/10",
  },
  unknown: {
    icon: HelpCircle,
    color: "text-muted-foreground",
    bg: "bg-muted",
  },
};

export const EvidenceCheck = memo(function EvidenceCheck({
  check,
  index = 0,
}: EvidenceCheckProps) {
  const config = statusConfig[check.status];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-start gap-2 py-1.5"
    >
      <div
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
          config.bg
        )}
      >
        <Icon className={cn("h-3 w-3", config.color)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{check.name}</p>
        {check.detail && (
          <p className="text-xs text-muted-foreground">{check.detail}</p>
        )}
        {check.source && (
          <p className="mt-0.5 text-xs text-muted-foreground/70 italic">
            Source: {check.source}
          </p>
        )}
      </div>
    </motion.div>
  );
});

export interface EvidenceGapProps {
  gap: NonNullable<EvidencePayload["gaps"]>[number];
  index?: number;
}

export const EvidenceGap = memo(function EvidenceGap({
  gap,
  index = 0,
}: EvidenceGapProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-start gap-2 py-1.5"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{gap.missing}</p>
        <p className="text-xs text-muted-foreground">{gap.why}</p>
      </div>
    </motion.div>
  );
});

export interface EvidenceSignalProps {
  signal: NonNullable<EvidencePayload["signals"]>[number];
  index?: number;
}

export const EvidenceSignal = memo(function EvidenceSignal({
  signal,
  index = 0,
}: EvidenceSignalProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-md border border-border bg-card p-2"
    >
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {signal.type}
        </Badge>
        <span className="text-xs text-muted-foreground">{signal.source}</span>
      </div>
      <p className="mt-1 text-sm text-foreground">{signal.summary}</p>
      {signal.referenceUrl && (
        <a
          href={signal.referenceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Link2 className="h-3 w-3" />
          Reference
        </a>
      )}
    </motion.div>
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

  const passCount = evidence.checks?.filter((c) => c.status === "pass").length ?? 0;
  const failCount = evidence.checks?.filter((c) => c.status === "fail").length ?? 0;

  if (totalCount === 0) return null;

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
          <FileSearch className="h-4 w-4 shrink-0 text-primary" />
          <span className="flex-1 text-sm font-medium text-foreground">
            Evidence collected
          </span>
          <div className="flex items-center gap-1.5">
            {passCount > 0 && (
              <Badge variant="secondary" className="gap-1 text-xs bg-status-positive/10 text-status-positive border-0">
                <CheckCircle2 className="h-3 w-3" />
                {passCount}
              </Badge>
            )}
            {failCount > 0 && (
              <Badge variant="secondary" className="gap-1 text-xs bg-destructive/10 text-destructive border-0">
                <XCircle className="h-3 w-3" />
                {failCount}
              </Badge>
            )}
          </div>
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
            className="border-t border-border p-3 space-y-4"
          >
            {/* Checks */}
            {evidence.checks && evidence.checks.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Checks
                </p>
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
                <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Gaps identified
                </p>
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
                <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Signals
                </p>
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
          </motion.div>
        </CollapsibleContent>
      </motion.div>
    </Collapsible>
  );
});
