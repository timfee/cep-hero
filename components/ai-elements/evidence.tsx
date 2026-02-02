"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { CheckCircle2, AlertCircle, HelpCircle, FileSearch } from "lucide-react";
import type { ComponentProps } from "react";
import type { EvidencePayload } from "@/types/chat";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

export type EvidenceCheckProps = {
  check: {
    name: string;
    status: "pass" | "fail" | "unknown";
    detail?: string;
    source?: string;
  };
  index?: number;
};

export function EvidenceCheck({ check, index = 0 }: EvidenceCheckProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-start gap-2"
    >
      {check.status === "pass" ? (
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-status-positive" />
      ) : check.status === "fail" ? (
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-destructive" />
      ) : (
        <HelpCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground">{check.name}</p>
        {check.detail && (
          <p className="text-xs text-muted-foreground">{check.detail}</p>
        )}
        {check.source && (
          <p className="text-xs italic text-muted-foreground/70">
            Source: {check.source}
          </p>
        )}
      </div>
    </motion.div>
  );
}

export type EvidencePanelProps = ComponentProps<"div"> & {
  evidence: EvidencePayload;
  defaultOpen?: boolean;
};

export function EvidencePanel({
  evidence,
  defaultOpen = false,
  className,
  ...props
}: EvidencePanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const checks = evidence.checks ?? [];

  if (!checks.length) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-left transition-colors hover:bg-muted/50",
          className
        )}
        {...props}
      >
        <FileSearch className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 text-xs font-medium text-foreground">
          Evidence
        </span>
        <Badge variant="secondary" className="text-xs">
          {checks.length}
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
          className="mt-2 space-y-2 rounded-lg border border-border bg-muted/30 p-3"
        >
          {checks.map((check, i) => (
            <EvidenceCheck key={i} check={check} index={i} />
          ))}
        </motion.div>
      </CollapsibleContent>
    </Collapsible>
  );
}
