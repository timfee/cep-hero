"use client";

import { ArrowRight } from "lucide-react";
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
  status: "healthy" | "warning" | "critical" | "error";
  detail: string;
  source: string;
  action?: string;
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
  const { data, error, isLoading } = useSWR<OverviewData>(
    "/api/overview",
    fetcher,
    { refreshInterval: 60000 }
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-muted-foreground">Loading...</span>
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

  const unhealthyCards = data.postureCards.filter(
    (c) => c.status !== "healthy"
  );
  const hasIssues = unhealthyCards.length > 0 || data.suggestions.length > 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-16">
        <header className="mb-16">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            {data.headline}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            {data.summary}
          </p>
        </header>

        {hasIssues ? (
          <div className="space-y-12">
            {unhealthyCards.length > 0 && (
              <section>
                <h2 className="mb-6 text-sm font-medium text-muted-foreground">
                  Needs attention
                </h2>
                <div className="space-y-3">
                  {unhealthyCards.map((card, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => card.action && onAction(card.action)}
                      disabled={!card.action}
                      className={cn(
                        "group flex w-full items-center justify-between rounded-2xl p-6 text-left",
                        "border border-white/10 bg-white/[0.04] backdrop-blur-xl",
                        "transition-all duration-200",
                        card.action &&
                          "hover:border-white/15 hover:bg-white/[0.08]",
                        !card.action && "cursor-default"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <span
                          className={cn(
                            "h-2.5 w-2.5 rounded-full",
                            card.status === "warning" &&
                              "bg-(--color-status-warning)",
                            card.status === "critical" &&
                              "bg-(--color-status-error)",
                            card.status === "error" &&
                              "bg-(--color-status-error)"
                          )}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">
                              {card.label}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {card.detail}
                          </p>
                        </div>
                      </div>
                      {card.action && (
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100" />
                      )}
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
                        <span className="h-2.5 w-2.5 rounded-full bg-(--color-status-info)" />
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
              <span className="h-3 w-3 rounded-full bg-(--color-status-healthy)" />
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
