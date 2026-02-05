"use client";

import { InfoIcon } from "lucide-react";
import { memo } from "react";

import { OrgUnitDisplay } from "@/components/ui/org-unit-display";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TOOLTIPS } from "@/lib/terminology";

interface DlpRule {
  id?: string;
  displayName?: string;
  description?: string;
  settingType?: string;
  policyType?: string;
  orgUnit?: string;
  consoleUrl?: string;
}

interface DlpRulesOutput {
  rules?: DlpRule[];
  error?: string;
  suggestion?: string;
}

/**
 * Formats the trigger type for display (e.g., "UPLOAD" → "Upload").
 */
function formatTrigger(trigger: string) {
  return trigger
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Formats the action type with appropriate styling class.
 */
function getActionStyle(action: string) {
  switch (action.toUpperCase()) {
    case "BLOCK":
      return "text-destructive";
    case "WARN":
      return "text-yellow-600 dark:text-yellow-500";
    case "AUDIT":
    default:
      return "text-muted-foreground";
  }
}

/**
 * Renders a compact trigger → action badge.
 */
function TriggerActionBadge({
  triggers,
  action,
}: {
  triggers: string;
  action: string;
}) {
  if (!triggers && !action) {
    return null;
  }

  const formattedTriggers = triggers
    ? triggers
        .split(/[,\s]+/)
        .filter(Boolean)
        .map(formatTrigger)
        .join(", ")
    : null;
  const formattedAction = action || "Audit";

  return (
    <span className="text-xs">
      {formattedTriggers && (
        <>
          <span className="text-muted-foreground">{formattedTriggers}</span>
          <span className="text-muted-foreground"> → </span>
        </>
      )}
      <span className={getActionStyle(formattedAction)}>{formattedAction}</span>
    </span>
  );
}

export const DlpRulesCard = memo(function DlpRulesCard({
  output,
}: {
  output: DlpRulesOutput;
}) {
  if (output.error) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-foreground">
        <p className="font-medium">DLP rules unavailable</p>
        <p className="text-muted-foreground">{output.error}</p>
        {output.suggestion && (
          <p className="text-muted-foreground">{output.suggestion}</p>
        )}
      </div>
    );
  }

  const rules = output.rules ?? [];

  if (rules.length === 0) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        No DLP rules were returned for this customer.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-background">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">
            Data Protection Rules
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <InfoIcon className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>{TOOLTIPS.dlpRules}</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <p className="text-xs text-muted-foreground">
          Showing {Math.min(rules.length, 8)} of {rules.length} rules
        </p>
      </div>
      <div className="divide-y divide-border">
        {rules.slice(0, 8).map((rule, index) => (
          <div key={rule.id ?? index} className="px-3 py-2 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-foreground">
                {rule.displayName ?? rule.id ?? "Unnamed rule"}
              </span>
              <TriggerActionBadge
                triggers={rule.settingType ?? ""}
                action={rule.policyType ?? ""}
              />
            </div>
            {rule.orgUnit && rule.orgUnit !== "/" && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span>Scope:</span>
                <OrgUnitDisplay targetResource={rule.orgUnit} size="sm" />
              </p>
            )}
            {rule.consoleUrl && (
              <a
                className="text-xs text-primary underline"
                href={rule.consoleUrl}
                target="_blank"
                rel="noopener"
              >
                View in Admin console
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});
