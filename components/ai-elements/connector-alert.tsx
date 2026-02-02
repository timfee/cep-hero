"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { AlertCircle } from "lucide-react";
import type { ComponentProps } from "react";
import type { ConnectorAnalysis } from "@/types/chat";

export type ConnectorAlertProps = ComponentProps<"div"> & {
  analysis: ConnectorAnalysis;
};

export function ConnectorAlert({
  analysis,
  className,
  ...props
}: ConnectorAlertProps) {
  if (!analysis?.flag) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "flex items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2",
        className
      )}
      {...props}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-status-warning" />
      <div>
        <p className="text-xs font-medium text-foreground">
          Connector scope issue detected
        </p>
        <p className="text-xs text-muted-foreground">
          {analysis.misScoped} of {analysis.total} policies may be mis-scoped
          {analysis.sampleTarget && ` (sample: ${analysis.sampleTarget})`}
        </p>
        {analysis.detail && (
          <p className="mt-1 text-xs text-muted-foreground">{analysis.detail}</p>
        )}
      </div>
    </motion.div>
  );
}
