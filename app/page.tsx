"use client";

import { useEffect, useMemo, useState } from "react";

import { ChatConsole } from "@/components/chat/chat-console";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowRight, MessageSquare } from "lucide-react";

type OverviewCard = {
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
  postureCards: OverviewCard[];
  suggestions: string[];
  sources: string[];
};

const DEFAULT_SUGGESTIONS = [
  "Show recent Chrome events",
  "List connector policies and targets",
  "Check DLP rules and alerts",
  "Retry connector fetch",
];

const QUICK_ACTIONS = [
  { label: "Retry connector fetch", description: "Re-check connector status" },
  { label: "List connector policies", description: "View all policies" },
  { label: "Check org units", description: "Inspect OU structure" },
  { label: "Check auth scopes", description: "Verify permissions" },
];

export default function Home() {
  const [overview, setOverview] = useState<OverviewData | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/overview");
        if (!res.ok) throw new Error(`overview ${res.status}`);
        const data = await res.json();
        if (!active) return;
        setOverview(
          normalizeOverview(data) ?? {
            headline: "Fleet posture",
            summary: "",
            postureCards: [],
            suggestions: DEFAULT_SUGGESTIONS,
            sources: [],
          }
        );
      } catch {
        if (!active) return;
        setOverview(null);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const suggestions = useMemo(() => {
    if (overview?.suggestions?.length) return overview.suggestions;
    return DEFAULT_SUGGESTIONS;
  }, [overview]);

  const dispatchCommand = (command: string) => {
    document.dispatchEvent(
      new CustomEvent("cep-action", { detail: { command } })
    );
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Minimal Header */}
        <header className="mb-6">
          <h1 className="text-lg font-semibold text-foreground">
            CEP Command Center
          </h1>
          <p className="text-sm text-muted-foreground">
            Chrome Enterprise Premium diagnostics and remediation
          </p>
        </header>

        {/* Main Layout */}
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Primary: Chat Console */}
          <div className="min-h-[600px]">
            <ChatConsole />
          </div>

          {/* Sidebar */}
          <aside className="space-y-5">
            {/* Quick Actions */}
            <section>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Quick Actions
              </h2>
              <div className="space-y-2">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => dispatchCommand(action.label)}
                    className="group flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:border-foreground/20 hover:bg-accent"
                  >
                    <div>
                      <span className="text-sm font-medium text-foreground">
                        {action.label}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {action.description}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </section>

            {/* Suggestions */}
            <section>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Suggested Prompts
              </h2>
              <div className="space-y-1">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => dispatchCommand(suggestion)}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{suggestion}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Status Summary */}
            {overview && overview.postureCards.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Fleet Status
                </h2>
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="grid grid-cols-2 gap-4">
                    {overview.postureCards.slice(0, 4).map((card) => (
                      <button
                        key={card.label}
                        onClick={() => dispatchCommand(card.action)}
                        className="text-left transition-opacity hover:opacity-70"
                      >
                        <div className="text-2xl font-semibold text-foreground">
                          {card.value}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {card.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

function normalizeOverview(data: unknown): OverviewData | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  const postureCards = Array.isArray(obj.postureCards)
    ? (obj.postureCards as OverviewCard[])
    : [];
  return {
    headline: typeof obj.headline === "string" ? obj.headline : "Fleet posture",
    summary: typeof obj.summary === "string" ? obj.summary : "",
    postureCards,
    suggestions: Array.isArray(obj.suggestions)
      ? (obj.suggestions as string[])
      : [],
    sources: Array.isArray(obj.sources) ? (obj.sources as string[]) : [],
  };
}
