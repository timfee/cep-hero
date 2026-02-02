"use client";

import { memo, useState } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ActionItem {
  id: string;
  label?: string;
  command?: string;
  primary?: boolean;
  disabled?: boolean;
}

export interface ActionButtonsProps {
  actions: ActionItem[];
  className?: string;
  onAction?: (command: string) => void;
  disabled?: boolean;
}

export const ActionButtons = memo(function ActionButtons({
  actions,
  className,
  onAction,
  disabled: globalDisabled,
}: ActionButtonsProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  if (actions.length === 0) return null;

  const handleClick = (action: ActionItem) => {
    if (globalDisabled || action.disabled || loadingId) return;
    const cmd = action.command ?? action.label ?? action.id;
    setLoadingId(action.id);
    onAction?.(cmd);
    // Reset loading state after a short delay (action will typically navigate or update state)
    setTimeout(() => setLoadingId(null), 1500);
  };

  return (
    <div className={cn("flex flex-wrap gap-2 lg:gap-3", className)}>
      {actions.map((action) => {
        const isLoading = loadingId === action.id;
        const isDisabled = globalDisabled || action.disabled || (loadingId !== null && !isLoading);
        
        return (
          <button
            key={action.id}
            onClick={() => handleClick(action)}
            disabled={isDisabled}
            aria-busy={isLoading}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.98]",
              action.primary
                ? "bg-foreground text-background hover:bg-foreground/90"
                : "bg-muted text-foreground hover:bg-muted/80",
              isDisabled && "pointer-events-none opacity-50",
              isLoading && "cursor-wait"
            )}
          >
            {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            {action.label ?? action.id}
          </button>
        );
      })}
    </div>
  );
});
