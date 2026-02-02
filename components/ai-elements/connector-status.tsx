"use client";

import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle } from "lucide-react";
import type { ConnectorAnalysis } from "@/types/chat";
import { memo } from "react";

export interface ConnectorStatusProps {
  analysis: ConnectorAnalysis;
  className?: string;
}

export const ConnectorStatus = memo(function ConnectorStatus({
  analysis,
  className,
}: ConnectorStatusProps) {
  const isHealthy = !analysis.flag;

  return (
    <div
      className={cn(
        "rounded-md border p-3",
        isHealthy ? "border-border bg-muted/30" : "border-border bg-muted/30",
        className
      )}
    >
      <div className="flex items-start gap-2">
        {isHealthy ? (
          <CheckCircle className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
        ) : (
          <AlertCircle className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground">
            {isHealthy
              ? "Connector policies properly scoped"
              : "Connector scope issue detected"}
          </p>
          <p className="text-xs text-muted-foreground">
            {analysis.total} {analysis.total === 1 ? "policy" : "policies"} analyzed
            {analysis.misScoped > 0 && ` (${analysis.misScoped} may need attention)`}
          </p>
        </div>
      </div>

      {analysis.flag && analysis.sampleTarget && (
        <div className="mt-2 rounded border border-border bg-background px-2 py-1.5">
          <code className="text-xs font-mono text-foreground break-all">
            {analysis.sampleTarget}
          </code>
        </div>
      )}
    </div>
  );
});
