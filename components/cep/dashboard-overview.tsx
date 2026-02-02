"use client";

import { ArrowRight, RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";
import useSWR from "swr";

import { cn } from "@/lib/utils";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch: ${res.status}`);
  }
  return res.json();
};

type PostureCard = {
  label: string;
  value: string;
  note: string;
  source: string;
  action: string;
  lastUpdated?: string;
};

type OverviewData = {
  headline: string;
  summary: string;
  postureCards: PostureCard[];
  suggestions: string[];
  sources: string[];
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
    setIsRefreshing(true);
    await mutate();
    setIsRefreshing(false);
  }, [mutate]);

  if (isLoading && !data) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 py-16">
          <header className="mb-16">
            <div className="h-10 w-3/4 animate-pulse rounded-lg bg-white/[0.06]" />
            <div className="mt-5 space-y-2">
              <div className="h-5 w-full animate-pulse rounded bg-white/[0.04]" />
              <div className="h-5 w-5/6 animate-pulse rounded bg-white/[0.04]" />
            </div>
          </header>
          <section>
            <div className="mb-6 h-4 w-24 animate-pulse rounded bg-white/[0.04]" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]"
                  style={{ animationDelay: `${i * 100}ms` }}
                />
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
                  {data.postureCards.map((card, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onAction(card.action)}
                      className={cn(
                        "group flex w-full items-center justify-between rounded-2xl p-6 text-left",
                        "border border-white/10 bg-white/[0.04] backdrop-blur-xl",
                        "transition-all duration-200",
                        "hover:border-white/15 hover:bg-white/[0.08]"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-status-info)]" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">
                              {card.label}
                            </span>
                            <span className="text-muted-foreground">
                              {card.value}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {card.note}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {data.suggestions.length > 0 && (
              <section>
                <h2 className="mb-6 text-sm font-medium text-muted-foreground">
                  Suggestions
                </h2>
                <div className="space-y-3">
                  {data.suggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onAction(suggestion)}
                      className={cn(
                        "group flex w-full items-center justify-between rounded-2xl p-6 text-left",
                        "border border-white/10 bg-white/[0.04] backdrop-blur-xl",
                        "transition-all duration-200",
                        "hover:border-white/15 hover:bg-white/[0.08]"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-status-info)]" />
                        <p className="text-foreground">{suggestion}</p>
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
