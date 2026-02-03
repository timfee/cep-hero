"use client";

import { InfoIcon } from "lucide-react";
import { memo } from "react";

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
  consoleUrl?: string;
}

interface DlpRulesOutput {
  rules?: DlpRule[];
  error?: string;
  suggestion?: string;
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
            <p className="font-medium text-foreground">
              {rule.displayName ?? rule.id ?? "Unnamed rule"}
            </p>
            {rule.description && (
              <p className="text-xs text-muted-foreground">
                {rule.description}
              </p>
            )}
            {rule.consoleUrl && (
              <a
                className="text-xs text-primary underline"
                href={rule.consoleUrl}
                target="_blank"
                rel="noopener"
              >
                Open in Admin console
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});
