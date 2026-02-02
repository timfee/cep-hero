"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import {
  AlertTriangle,
  CheckCircle2,
  Building2,
  Users,
  FolderTree,
  HelpCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ConnectorAnalysis } from "@/types/chat";
import { memo } from "react";

export interface ConnectorStatusProps {
  analysis: ConnectorAnalysis;
  className?: string;
}

const targetIcons = {
  customer: Building2,
  orgUnit: FolderTree,
  group: Users,
  unknown: HelpCircle,
};

const targetLabels = {
  customer: "Customer-level",
  orgUnit: "Org Unit",
  group: "Group",
  unknown: "Unknown",
};

export const ConnectorStatus = memo(function ConnectorStatus({
  analysis,
  className,
}: ConnectorStatusProps) {
  const isHealthy = !analysis.flag;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "rounded-lg border p-3",
        isHealthy
          ? "border-status-positive/30 bg-status-positive/5"
          : "border-status-warning/30 bg-status-warning/5",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            isHealthy ? "bg-status-positive/10" : "bg-status-warning/10"
          )}
        >
          {isHealthy ? (
            <CheckCircle2 className="h-4 w-4 text-status-positive" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-status-warning" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {isHealthy
              ? "Connector policies properly scoped"
              : "Connector scope issue detected"}
          </p>
          <p className="text-xs text-muted-foreground">
            {analysis.total} {analysis.total === 1 ? "policy" : "policies"}{" "}
            analyzed
            {analysis.misScoped > 0 && (
              <span className="text-status-warning">
                {" "}
                ({analysis.misScoped} may be mis-scoped)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Target breakdown */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        {(Object.keys(analysis.byTarget) as Array<keyof typeof analysis.byTarget>).map(
          (key) => {
            const Icon = targetIcons[key];
            const count = analysis.byTarget[key];
            const isWarning = key === "customer" && count > 0;

            return (
              <div
                key={key}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md border p-2",
                  isWarning
                    ? "border-status-warning/30 bg-status-warning/5"
                    : "border-border bg-card/50"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4",
                    isWarning ? "text-status-warning" : "text-muted-foreground"
                  )}
                />
                <span
                  className={cn(
                    "text-lg font-semibold tabular-nums",
                    isWarning ? "text-status-warning" : "text-foreground"
                  )}
                >
                  {count}
                </span>
                <span className="text-xs text-muted-foreground text-center">
                  {targetLabels[key]}
                </span>
              </div>
            );
          }
        )}
      </div>

      {/* Sample target if mis-scoped */}
      {analysis.flag && analysis.sampleTarget && (
        <div className="mt-3 rounded-md border border-status-warning/30 bg-status-warning/10 px-3 py-2">
          <p className="text-xs text-muted-foreground">Sample mis-scoped target:</p>
          <code className="mt-1 block text-xs font-mono text-foreground break-all">
            {analysis.sampleTarget}
          </code>
        </div>
      )}
    </motion.div>
  );
});
