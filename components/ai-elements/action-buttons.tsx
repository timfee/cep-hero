"use client";

import { memo } from "react";

import { cn } from "@/lib/utils";

export interface ActionItem {
  id: string;
  label?: string;
  command?: string;
  primary?: boolean;
}

export interface ActionButtonsProps {
  actions: ActionItem[];
  className?: string;
  onAction?: (command: string) => void;
}

export const ActionButtons = memo(function ActionButtons({
  actions,
  className,
  onAction,
}: ActionButtonsProps) {
  if (actions.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={() => {
            const cmd = action.command ?? action.label ?? action.id;
            onAction?.(cmd);
          }}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            action.primary
              ? "bg-foreground text-background hover:bg-foreground/90"
              : "bg-muted text-foreground hover:bg-muted/80"
          )}
        >
          {action.label ?? action.id}
        </button>
      ))}
    </div>
  );
});
