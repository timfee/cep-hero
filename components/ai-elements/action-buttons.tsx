"use client";

import { track } from "@vercel/analytics";
import { Loader2 } from "lucide-react";
import { memo, useState, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

const CONFIRM_PATTERN = /^confirm\b/i;
const CANCEL_PATTERN = /^(cancel|no)\b/i;

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
  resetKey?: unknown;
}

export const ActionButtons = memo(function ActionButtons({
  actions,
  className,
  onAction,
  disabled: globalDisabled,
  resetKey,
}: ActionButtonsProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Reset loading state when actions or resetKey changes
  useEffect(() => {
    setLoadingId(null);
  }, [actions, resetKey, globalDisabled]);

  if (actions.length === 0) return null;

  const handleClick = async (action: ActionItem) => {
    if (globalDisabled || action.disabled || loadingId) return;
    const cmd = action.command ?? action.label ?? action.id;
    if (!cmd) return;
    await track("Action Button Clicked", { label: action.label ?? action.id });
    setLoadingId(action.id);
    onAction?.(cmd);
    // Clear any existing timeout before setting a new one
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }
    // Reset loading state after a short delay (action will typically navigate or update state)
    timeoutRef.current = setTimeout(() => setLoadingId(null), 1500);
  };

  return (
    <div className={cn("flex flex-wrap gap-2.5 lg:gap-3", className)}>
      {actions.map((action) => {
        const isLoading = loadingId === action.id;
        const isDisabled =
          globalDisabled ||
          action.disabled ||
          (loadingId !== null && !isLoading);
        const label = action.label ?? action.command ?? action.id;
        const isConfirm = CONFIRM_PATTERN.test(label.trim());
        const isCancel = CANCEL_PATTERN.test(label.trim());

        return (
          <button
            key={action.id}
            type="button"
            onClick={() => handleClick(action)}
            disabled={isDisabled}
            aria-busy={isLoading}
            aria-disabled={isDisabled}
            title={label}
            className={cn(
              "inline-flex cursor-pointer items-center gap-2 whitespace-normal rounded-md px-3 py-2 text-left text-xs font-medium leading-snug transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              action.primary || isConfirm
                ? "bg-foreground text-background hover:bg-foreground/90"
                : isCancel
                  ? "bg-muted/40 text-muted-foreground hover:bg-muted/50"
                  : "bg-muted text-foreground hover:bg-muted/80",
              isDisabled && "pointer-events-none opacity-50",
              isLoading && "cursor-wait"
            )}
          >
            {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            <span>{label}</span>
            {isLoading && <span className="sr-only">Sending</span>}
          </button>
        );
      })}
    </div>
  );
});
