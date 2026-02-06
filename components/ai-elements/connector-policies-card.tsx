/**
 * Compact connector policy scope card. Collapsed by default — a single
 * summary line with policy count and scope health. Expands to show per-target
 * org-unit breakdown.
 */
"use client";

import { ChevronDown, InfoIcon, Shield } from "lucide-react";
import { motion } from "motion/react";
import { memo, useMemo, useState } from "react";

import type { ConnectorAnalysis, ConnectorConfigOutput } from "@/types/chat";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { OrgUnitDisplay } from "@/components/ui/org-unit-display";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { analyzeConnectorPolicies } from "@/lib/mcp/connector-analysis";
import { TOOLTIPS } from "@/lib/terminology";
import { cn } from "@/lib/utils";

/**
 * Builds a short human-readable summary string for the collapsed header.
 */
function buildSummary(analysis: ConnectorAnalysis): string {
  if (analysis.total === 0) {
    return "No connector policies configured";
  }
  const parts: string[] = [
    `${analysis.total} ${analysis.total === 1 ? "policy" : "policies"}`,
  ];
  if (analysis.misScoped > 0) {
    parts.push(`${analysis.misScoped} mis-scoped`);
  }
  return parts.join(" · ");
}

export const ConnectorPoliciesCard = memo(function ConnectorPoliciesCard({
  output,
}: {
  output: ConnectorConfigOutput;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const policies = output.value ?? [];
  const analysis = useMemo(
    () => analyzeConnectorPolicies(policies),
    [policies]
  );
  const summary = useMemo(() => buildSummary(analysis), [analysis]);

  if (output.error) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-foreground">
        <p className="font-medium">Connector policies unavailable</p>
        <p className="text-muted-foreground">{output.error}</p>
        {output.suggestion && (
          <p className="text-muted-foreground">{output.suggestion}</p>
        )}
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-lg border border-border bg-card overflow-hidden"
      >
        <div className="flex w-full items-center gap-2.5 px-3 py-2.5">
          <CollapsibleTrigger className="flex flex-1 items-center gap-2.5 text-left transition-colors hover:bg-muted/50 rounded-sm min-w-0">
            <Shield
              className={cn(
                "h-4 w-4 shrink-0",
                analysis.flag
                  ? "text-orange-400"
                  : analysis.total > 0
                    ? "text-status-positive"
                    : "text-muted-foreground"
              )}
            />
            <span className="flex-1 text-sm text-foreground truncate">
              {summary}
            </span>
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </motion.div>
          </CollapsibleTrigger>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Policy scope help"
                className="shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <InfoIcon className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>{TOOLTIPS.policyScope}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <CollapsibleContent>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="border-t border-border px-3 py-2.5 text-sm"
          >
            {policies.length === 0 ? (
              <span className="text-muted-foreground">
                No policies were returned
                {(output.attemptedTargets?.length ?? 0) > 0 &&
                  ` (checked ${output.attemptedTargets?.length} ${output.attemptedTargets?.length === 1 ? "location" : "locations"})`}
                .
              </span>
            ) : (
              <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
                {policies.slice(0, 6).map((policy, index) => {
                  const target =
                    policy.policyTargetKey?.targetResource ?? "Unknown";
                  return (
                    <span key={`${target}-${index}`}>
                      <OrgUnitDisplay targetResource={target} size="sm" />
                      {index < Math.min(policies.length, 6) - 1 && (
                        <span className="text-muted-foreground">,</span>
                      )}
                    </span>
                  );
                })}
                {policies.length > 6 && (
                  <span className="text-xs text-muted-foreground">
                    +{policies.length - 6} more
                  </span>
                )}
              </span>
            )}

            {analysis.flag && analysis.sampleTarget && (
              <div className="mt-2 rounded border border-border bg-background px-2 py-1.5">
                <code className="text-xs font-mono text-foreground break-all">
                  {analysis.sampleTarget}
                </code>
              </div>
            )}
          </motion.div>
        </CollapsibleContent>
      </motion.div>
    </Collapsible>
  );
});
