/**
 * Renders structured tool results (success, error, manual steps) from
 * createDLPRule and applyPolicyChange as compact inline cards.
 */
"use client";

import { AlertCircle, CheckCircle, ExternalLink } from "lucide-react";
import { memo } from "react";

import type { ToolResultOutput } from "@/types/chat";

import { cn } from "@/lib/utils";

/**
 * Displays a tool result with appropriate icon, message, and optional details.
 */
export const ToolResultCard = memo(function ToolResultCard({
  output,
  className,
}: {
  output: ToolResultOutput;
  className?: string;
}) {
  const isSuccess = output._type === "ui.success";
  const isManual = output._type === "ui.manual_steps";

  return (
    <div
      className={cn(
        "rounded-md border p-3",
        "border-border bg-muted/30",
        className
      )}
    >
      <div className="flex items-start gap-2">
        {isSuccess ? (
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
        ) : (
          <AlertCircle
            className={cn(
              "h-4 w-4 shrink-0 mt-0.5",
              isManual ? "text-orange-400" : "text-red-400"
            )}
          />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          {output.message && (
            <p className="text-sm text-foreground">{output.message}</p>
          )}

          {output._type === "ui.error" && output.error && (
            <p className="text-xs text-muted-foreground">{output.error}</p>
          )}

          {output._type === "ui.error" && output.suggestion && (
            <p className="text-xs text-muted-foreground">{output.suggestion}</p>
          )}

          {output._type === "ui.manual_steps" && output.error && (
            <p className="text-xs text-muted-foreground">{output.error}</p>
          )}

          {output._type === "ui.manual_steps" && output.steps.length > 0 && (
            <ol className="list-decimal list-inside space-y-0.5 text-xs text-muted-foreground">
              {output.steps.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          )}

          {output.consoleUrl && (
            <a
              href={output.consoleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Admin Console <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
});
