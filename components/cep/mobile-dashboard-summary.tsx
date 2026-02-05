/**
 * Condensed dashboard summary for mobile devices.
 * Shows a collapsible header with key fleet status that expands to full dashboard.
 */

"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Shield,
  AlertTriangle,
  AlertCircle,
  Info,
} from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

import type { OverviewData, PostureCardStatus } from "@/lib/overview";

import { Shimmer } from "@/components/ai-elements/shimmer";
import { cn } from "@/lib/utils";

/**
 * Fetch JSON data from a URL, throwing on non-OK responses.
 */
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch: ${res.status}`);
  }
  return res.json();
};

const STATUS_CONFIG: Record<
  PostureCardStatus,
  { color: string; bgColor: string; icon: typeof Shield }
> = {
  healthy: {
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20",
    icon: Shield,
  },
  warning: {
    color: "text-amber-400",
    bgColor: "bg-amber-500/20",
    icon: AlertTriangle,
  },
  critical: {
    color: "text-red-400",
    bgColor: "bg-red-500/20",
    icon: AlertCircle,
  },
  info: {
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
    icon: Info,
  },
};

interface MobileDashboardSummaryProps {
  onAction: (command: string) => void;
}

/**
 * Compact, expandable dashboard summary for mobile screens.
 * Displays key fleet status indicators that expand to show full details.
 */
export function MobileDashboardSummary({
  onAction,
}: MobileDashboardSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data, isLoading } = useSWR<OverviewData>("/api/overview", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    keepPreviousData: true,
  });

  const hasHeadlineContent = Boolean(
    data?.headline && data.headline.trim().length > 0
  );
  const hasSummaryContent = Boolean(
    data?.summary && data.summary.trim().length > 0
  );

  // Get top 3 posture cards by priority for the collapsed view
  const topPostureCards = data?.postureCards
    ? [...data.postureCards]
        .toSorted((a, b) => (a.priority ?? 5) - (b.priority ?? 5))
        .slice(0, 3)
    : [];

  // Count issues by severity for quick status
  const criticalCount =
    data?.postureCards.filter((c) => c.status === "critical").length ?? 0;
  const warningCount =
    data?.postureCards.filter((c) => c.status === "warning").length ?? 0;

  return (
    <div className="border-b border-white/[0.06] bg-black/40 backdrop-blur-xl">
      {/* Collapsed header - always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {/* Status indicator dot */}
          <div
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              criticalCount > 0
                ? "bg-red-400"
                : warningCount > 0
                  ? "bg-amber-400"
                  : "bg-emerald-400"
            )}
          />

          {/* Headline or loading state */}
          <div className="min-w-0 flex-1">
            {isLoading || !hasHeadlineContent ? (
              <Shimmer className="text-sm font-medium">
                Analyzing fleet...
              </Shimmer>
            ) : (
              <span className="truncate text-sm font-medium text-foreground">
                {data?.headline}
              </span>
            )}
          </div>

          {/* Quick status pills */}
          <div className="flex shrink-0 items-center gap-1.5">
            {topPostureCards.slice(0, 2).map((card, idx) => {
              const status = card.status ?? "info";
              const config = STATUS_CONFIG[status];
              const StatusIcon = config.icon;
              return (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-0.5",
                    config.bgColor
                  )}
                >
                  <StatusIcon className={cn("h-3 w-3", config.color)} />
                  <span className={cn("text-xs font-medium", config.color)}>
                    {card.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Expand/collapse chevron */}
        <ChevronDown
          className={cn(
            "ml-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-4 px-4 pb-4">
              {/* Summary text */}
              {hasSummaryContent && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {data?.summary}
                </p>
              )}

              {/* Posture cards */}
              {topPostureCards.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground">
                    Fleet posture
                  </h3>
                  <div className="space-y-2">
                    {topPostureCards.map((card, idx) => {
                      const status = card.status ?? "info";
                      const config = STATUS_CONFIG[status];
                      const StatusIcon = config.icon;

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            onAction(card.action);
                            setIsExpanded(false);
                          }}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl p-3 text-left",
                            "border border-white/10 bg-white/[0.04]",
                            "transition-colors hover:bg-white/[0.08]"
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                              config.bgColor
                            )}
                          >
                            <StatusIcon
                              className={cn("h-4 w-4", config.color)}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium text-foreground">
                                {card.label}
                              </span>
                              <span
                                className={cn(
                                  "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                                  config.bgColor,
                                  config.color
                                )}
                              >
                                {card.value}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {card.note}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Top recommendation */}
              {data?.suggestions && data.suggestions.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground">
                    Top recommendation
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      const topSuggestion = [...data.suggestions].toSorted(
                        (a, b) => a.priority - b.priority
                      )[0];
                      if (topSuggestion) {
                        onAction(topSuggestion.action);
                        setIsExpanded(false);
                      }
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl p-3 text-left",
                      "border border-white/10 bg-white/[0.04]",
                      "transition-colors hover:bg-white/[0.08]"
                    )}
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-xs font-bold text-red-400">
                      1
                    </div>
                    <span className="text-sm text-foreground">
                      {
                        [...data.suggestions].toSorted(
                          (a, b) => a.priority - b.priority
                        )[0]?.text
                      }
                    </span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
