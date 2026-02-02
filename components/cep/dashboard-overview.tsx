"use client";

import { track } from "@vercel/analytics";
import {
  ArrowRight,
  RefreshCw,
  Shield,
  AlertTriangle,
  AlertCircle,
  Info,
} from "lucide-react";
import { useCallback, useState } from "react";
import useSWR from "swr";

import type {
  Suggestion,
  PostureCardStatus,
  OverviewData,
} from "@/lib/overview";

import { PulseShimmer } from "@/components/ai-elements/shimmer";
import { cn } from "@/lib/utils";

const SKELETON_STAGGER_DELAY_MS = 100;

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

const CATEGORY_COLORS: Record<Suggestion["category"], string> = {
  security: "border-red-500/30 hover:border-red-500/50",
  compliance: "border-amber-500/30 hover:border-amber-500/50",
  monitoring: "border-blue-500/30 hover:border-blue-500/50",
  optimization: "border-emerald-500/30 hover:border-emerald-500/50",
};

type DashboardOverviewProps = {
  onAction: (command: string) => void;
};

export function DashboardOverview({ onAction }: DashboardOverviewProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<OverviewData>(
    "/api/overview",
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      keepPreviousData: true,
    }
  );

  const handleRefresh = useCallback(async () => {
    track("Dashboard Refreshed");
    setIsRefreshing(true);
    try {
      await mutate();
    } finally {
      setIsRefreshing(false);
    }
  }, [mutate]);

  if (isLoading && !data) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 py-16">
          <header className="mb-16">
            <PulseShimmer height={40} width="75%" className="rounded-lg" />
            <div className="mt-5 space-y-2">
              <PulseShimmer height={20} width="100%" className="rounded" />
              <PulseShimmer height={20} width="85%" className="rounded" />
            </div>
          </header>
          <section>
            <PulseShimmer height={16} width={96} className="mb-6 rounded" />
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    animationDelay: `${i * SKELETON_STAGGER_DELAY_MS}ms`,
                  }}
                >
                  <PulseShimmer
                    height={96}
                    className="rounded-2xl border border-white/10"
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-muted-foreground">Failed to load</span>
      </div>
    );
  }

  const hasContent =
    data.postureCards.length > 0 || data.suggestions.length > 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-16">
        <header className="mb-16">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground">
              {data.headline}
            </h1>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex flex-shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/[0.08] disabled:opacity-50"
              aria-label="Refresh dashboard"
            >
              <RefreshCw
                className={cn("h-4 w-4", isRefreshing && "animate-spin")}
              />
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            {data.summary}
          </p>
        </header>

        {hasContent ? (
          <div className="space-y-12">
            {data.postureCards.length > 0 && (
              <section>
                <h2 className="mb-6 text-sm font-medium text-muted-foreground">
                  Fleet posture
                </h2>
                <div className="space-y-3">
                  {[...data.postureCards]
                    .sort((a, b) => (a.priority ?? 5) - (b.priority ?? 5))
                    .map((card, idx) => {
                      const status = card.status ?? "info";
                      const config = STATUS_CONFIG[status];
                      const StatusIcon = config.icon;

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            track("Posture Card Clicked", {
                              label: card.label,
                              status: status,
                            });
                            onAction(card.action);
                          }}
                          className={cn(
                            "group flex w-full items-center justify-between rounded-2xl p-6 text-left",
                            "border border-white/10 bg-white/[0.04] backdrop-blur-xl",
                            "transition-all duration-200",
                            "hover:border-white/15 hover:bg-white/[0.08]"
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={cn(
                                "flex h-10 w-10 items-center justify-center rounded-full",
                                config.bgColor
                              )}
                            >
                              <StatusIcon
                                className={cn("h-5 w-5", config.color)}
                              />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <span className="font-medium text-foreground">
                                  {card.label}
                                </span>
                                <span
                                  className={cn(
                                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                                    config.bgColor,
                                    config.color
                                  )}
                                >
                                  {card.value}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {card.note}
                              </p>
                              {typeof card.progress === "number" && (
                                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                                  <div
                                    className={cn(
                                      "h-full rounded-full transition-all duration-500",
                                      status === "healthy"
                                        ? "bg-emerald-500"
                                        : status === "warning"
                                          ? "bg-amber-500"
                                          : status === "critical"
                                            ? "bg-red-500"
                                            : "bg-blue-500"
                                    )}
                                    style={{ width: `${card.progress}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100" />
                        </button>
                      );
                    })}
                </div>
              </section>
            )}

            {data.suggestions.length > 0 && (
              <section>
                <h2 className="mb-6 text-sm font-medium text-muted-foreground">
                  Recommended actions
                </h2>
                <div className="space-y-3">
                  {[...data.suggestions]
                    .sort((a, b) => a.priority - b.priority)
                    .map((suggestion, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          track("Suggestion Clicked", {
                            category: suggestion.category,
                          });
                          onAction(suggestion.action);
                        }}
                        className={cn(
                          "group flex w-full items-center justify-between rounded-2xl p-6 text-left",
                          "border bg-white/[0.04] backdrop-blur-xl",
                          "transition-all duration-200",
                          CATEGORY_COLORS[suggestion.category]
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                              suggestion.category === "security"
                                ? "bg-red-500/20 text-red-400"
                                : suggestion.category === "compliance"
                                  ? "bg-amber-500/20 text-amber-400"
                                  : suggestion.category === "monitoring"
                                    ? "bg-blue-500/20 text-blue-400"
                                    : "bg-emerald-500/20 text-emerald-400"
                            )}
                          >
                            {idx + 1}
                          </div>
                          <div>
                            <p className="text-foreground">{suggestion.text}</p>
                            <p className="mt-1 text-xs capitalize text-muted-foreground">
                              {suggestion.category}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100" />
                      </button>
                    ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-10 text-center backdrop-blur-xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06]">
              <span className="h-3 w-3 rounded-full bg-[var(--color-status-healthy)]" />
            </div>
            <p className="text-foreground">All systems healthy</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No issues require your attention
            </p>
          </div>
        )}

        {data.sources.length > 0 && (
          <footer className="mt-12 border-t border-white/10 pt-6">
            <p className="text-xs text-muted-foreground">
              Sources: {data.sources.join(", ")}
            </p>
          </footer>
        )}
      </div>
    </div>
  );
}
