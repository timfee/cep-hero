"use client";

import { useEffect, useMemo, useState } from "react";

import { ChatConsole } from "@/components/chat/ChatConsole";
import {
  DashboardPanel,
  DashboardPanelActions,
  DashboardPanelContent,
  DashboardPanelDescription,
  DashboardPanelHeader,
  DashboardPanelTitle,
} from "@/components/ui/dashboard-panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  Bolt,
  Network,
  ShieldCheck,
  Telescope,
} from "lucide-react";

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

export default function Home() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/overview");
        if (!res.ok) {
          throw new Error(`overview ${res.status}`);
        }
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
        setOverviewError(null);
      } catch (error) {
        if (!active) return;
        setOverview(null);
        setOverviewError("Unable to load overview");
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

  const primaryActions = [
    "Retry connector fetch",
    "List connector policies",
    "Check org units",
    "Check auth scopes",
  ];

  const dispatchCommand = (command: string) => {
    document.dispatchEvent(
      new CustomEvent("cep-action", { detail: { command } })
    );
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        {/* Hero Header Section */}
        <header className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-widest text-primary">
                CEP Command Center
              </p>
              <h1 className="text-2xl font-semibold text-foreground sm:text-3xl text-balance">
                Diagnose, remediate, and verify in one view
              </h1>
              <p className="max-w-xl text-sm text-muted-foreground leading-relaxed">
                Live actions, curated prompts, and posture snapshots to keep
                connectors and DLP healthy.
              </p>
            </div>
            <div className="flex flex-wrap gap-3" role="status" aria-label="System status indicators">
              <StatusBadge
                icon={ShieldCheck}
                label="Auth"
                value="Active"
                status="positive"
              />
              <StatusBadge
                icon={Network}
                label="MCP"
                value="Online"
                status="positive"
              />
              <StatusBadge
                icon={Telescope}
                label="Insights"
                value={overview?.headline ?? "Ready"}
                status="info"
              />
            </div>
          </div>
          <Separator className="my-4" />
          <div
            className="grid grid-cols-2 gap-3 md:grid-cols-4"
            role="region"
            aria-label="Key metrics"
          >
            {statCards(overview).map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </div>
        </header>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Chat Console - Primary Content */}
          <div className="lg:col-span-2">
            <ChatConsole />
          </div>

          {/* Sidebar Panels */}
          <aside className="flex flex-col gap-4" aria-label="Quick actions and suggestions">
            {/* Playbooks Panel */}
            <DashboardPanel>
              <DashboardPanelHeader>
                <DashboardPanelTitle>Playbooks</DashboardPanelTitle>
                <DashboardPanelDescription>
                  One-click guided flows
                </DashboardPanelDescription>
              </DashboardPanelHeader>
              <DashboardPanelContent>
                <DashboardPanelActions>
                  {primaryActions.map((action) => (
                    <Button
                      key={action}
                      variant="secondary"
                      className="justify-between text-left"
                      onClick={() => dispatchCommand(action)}
                    >
                      <span>{action}</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  ))}
                </DashboardPanelActions>
              </DashboardPanelContent>
            </DashboardPanel>

            {/* Suggested Prompts Panel */}
            <DashboardPanel>
              <DashboardPanelHeader>
                <DashboardPanelTitle>Suggested prompts</DashboardPanelTitle>
                <DashboardPanelDescription>
                  Ask or click to run
                </DashboardPanelDescription>
              </DashboardPanelHeader>
              <DashboardPanelContent>
                <DashboardPanelActions>
                  {suggestions.map((suggestion) => (
                    <Button
                      key={suggestion}
                      variant="ghost"
                      className="justify-start text-left text-muted-foreground hover:text-foreground"
                      onClick={() => dispatchCommand(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </DashboardPanelActions>
              </DashboardPanelContent>
            </DashboardPanel>

            {/* Posture Cards Panel */}
            <DashboardPanel>
              <DashboardPanelHeader>
                <DashboardPanelTitle>Posture cards</DashboardPanelTitle>
                <DashboardPanelDescription>
                  Tap a card to drill in
                </DashboardPanelDescription>
              </DashboardPanelHeader>
              <DashboardPanelContent className="flex flex-col gap-3">
                {(overview?.postureCards ?? []).slice(0, 4).map((card) => (
                  <Card
                    key={card.label}
                    className="border-border bg-accent/50 transition-colors hover:border-primary/40"
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{card.label}</CardTitle>
                      <CardDescription>
                        {card.source || "Chrome fleet"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                      <div className="text-lg font-semibold text-foreground">
                        {card.value}
                      </div>
                      {card.note && (
                        <p className="text-xs text-muted-foreground">
                          {card.note}
                        </p>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="mt-1 w-fit"
                        onClick={() => dispatchCommand(card.action)}
                      >
                        {card.action || "Ask about this"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {(overview?.postureCards?.length ?? 0) === 0 && (
                  <div className="rounded-lg border border-border bg-muted/50 px-3 py-4 text-center text-xs text-muted-foreground">
                    No posture cards yet. Try running &quot;Show recent Chrome
                    events&quot;.
                  </div>
                )}
              </DashboardPanelContent>
            </DashboardPanel>
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

type StatProps = {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  status?: "positive" | "warning" | "info";
};

function statCards(overview: OverviewData | null): StatProps[] {
  const cards = overview?.postureCards ?? [];
  const first = cards[0]?.value ?? "---";
  const second = cards[1]?.value ?? "---";
  const third = cards[2]?.value ?? "---";
  const fourth = cards[3]?.value ?? "---";
  return [
    {
      label: cards[0]?.label ?? "Events",
      value: String(first),
      icon: Bolt,
      status: "info",
    },
    {
      label: cards[1]?.label ?? "DLP Rules",
      value: String(second),
      icon: ShieldCheck,
      status: "info",
    },
    {
      label: cards[2]?.label ?? "Connectors",
      value: String(third),
      icon: Network,
      status: "warning",
    },
    {
      label: cards[3]?.label ?? "Findings",
      value: String(fourth),
      icon: AlertTriangle,
      status: "warning",
    },
  ];
}

function StatCard({ label, value, icon: Icon, status = "info" }: StatProps) {
  return (
    <div
      className="rounded-xl border border-border bg-accent/50 px-4 py-3"
      role="group"
      aria-label={`${label}: ${value}`}
    >
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        <Icon
          className={cn(
            "h-4 w-4",
            status === "positive" && "text-status-positive",
            status === "warning" && "text-status-warning",
            status === "info" && "text-status-info"
          )}
          aria-hidden="true"
        />
        <span>{label}</span>
      </div>
      <div className="pt-1 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}
