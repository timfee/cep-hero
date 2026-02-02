"use client";

import { useEffect, useMemo, useState } from "react";

import { ChatConsole } from "@/components/chat/ChatConsole";
import { Panel } from "@/components/ai-elements/panel";
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
  CheckCircle2,
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
    <main className="min-h-screen bg-[#070a12] text-zinc-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <div className="rounded-2xl border border-white/5 bg-gradient-to-r from-[#0d1221] via-[#0b132b] to-[#0f172a] p-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-blue-300/80">
                CEP Command Center
              </p>
              <h1 className="text-3xl font-semibold text-white">
                Diagnose, remediate, and verify in one view
              </h1>
              <p className="text-sm text-zinc-400">
                Live actions, curated prompts, and posture snapshots to keep connectors and DLP healthy.
              </p>
            </div>
            <div className="flex gap-3">
              <BadgePill icon={ShieldCheck} label="Auth" value="Active" tone="positive" />
              <BadgePill icon={Network} label="MCP" value="Online" tone="positive" />
              <BadgePill icon={Telescope} label="Insights" value={overview?.headline ?? "Ready"} />
            </div>
          </div>
          <Separator className="my-4 bg-white/5" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {statCards(overview).map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ChatConsole />
          </div>
          <div className="space-y-4">
            <Panel className="bg-[#0c111d] text-zinc-100">
              <div className="border-b border-white/5 px-4 py-3">
                <div className="text-sm font-medium text-white">Playbooks</div>
                <div className="text-xs text-zinc-500">One-click guided flows</div>
              </div>
              <div className="grid grid-cols-1 gap-2 px-4 py-3">
                {primaryActions.map((action) => (
                  <Button
                    key={action}
                    variant="secondary"
                    className="justify-between text-left text-sm"
                    onClick={() => dispatchCommand(action)}
                  >
                    <span>{action}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ))}
              </div>
            </Panel>

            <Panel className="bg-[#0c111d] text-zinc-100">
              <div className="border-b border-white/5 px-4 py-3">
                <div className="text-sm font-medium text-white">Suggested prompts</div>
                <div className="text-xs text-zinc-500">Ask or click to run</div>
              </div>
              <div className="grid grid-cols-1 gap-2 px-4 py-3">
                {suggestions.map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="ghost"
                    className="justify-start text-left text-sm text-zinc-200 hover:bg-white/5"
                    onClick={() => dispatchCommand(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </Panel>

            <Panel className="bg-[#0c111d] text-zinc-100">
              <div className="border-b border-white/5 px-4 py-3">
                <div className="text-sm font-medium text-white">Posture cards</div>
                <div className="text-xs text-zinc-500">Tap a card to drill in</div>
              </div>
              <div className="space-y-3 px-4 py-3">
                {(overview?.postureCards ?? []).slice(0, 4).map((card) => (
                  <Card
                    key={card.label}
                    className="border-white/5 bg-[#0f1320] text-zinc-100 hover:border-blue-500/40"
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-white">
                        {card.label}
                      </CardTitle>
                      <CardDescription className="text-xs text-zinc-500">
                        {card.source || "Chrome fleet"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-1 text-sm text-zinc-200">
                      <div className="text-lg font-semibold text-white">
                        {card.value}
                      </div>
                      {card.note ? (
                        <div className="text-xs text-zinc-400">{card.note}</div>
                      ) : null}
                      <div className="flex flex-wrap gap-2 pt-2 text-xs text-blue-300">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-8"
                          onClick={() => dispatchCommand(card.action)}
                        >
                          {card.action || "Ask about this"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {(overview?.postureCards?.length ?? 0) === 0 ? (
                  <div className="rounded-md border border-white/5 bg-black/30 px-3 py-3 text-xs text-zinc-500">
                    No posture cards yet. Try running "Show recent Chrome events".
                  </div>
                ) : null}
              </div>
            </Panel>
          </div>
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

type Stat = { label: string; value: string; icon: React.ComponentType<{ className?: string }>; tone?: "positive" | "warn" | "info" };

function statCards(overview: OverviewData | null): Stat[] {
  const cards = overview?.postureCards ?? [];
  const first = cards[0]?.value ?? "–";
  const second = cards[1]?.value ?? "–";
  const third = cards[2]?.value ?? "–";
  const fourth = cards[3]?.value ?? "–";
  return [
    { label: cards[0]?.label ?? "Events", value: String(first), icon: Bolt, tone: "info" },
    { label: cards[1]?.label ?? "DLP Rules", value: String(second), icon: ShieldCheck, tone: "info" },
    { label: cards[2]?.label ?? "Connectors", value: String(third), icon: Network, tone: "warn" },
    { label: cards[3]?.label ?? "Findings", value: String(fourth), icon: AlertTriangle, tone: "warn" },
  ];
}

function StatCard({ label, value, icon: Icon, tone = "info" }: Stat) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-300"
      : tone === "warn"
        ? "text-amber-300"
        : "text-blue-300";
  return (
    <div className="rounded-xl border border-white/5 bg-white/5 px-4 py-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-zinc-400">
        <Icon className={cn("h-4 w-4", toneClass)} />
        {label}
      </div>
      <div className="pt-1 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

type PillProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "positive" | "warn" | "info";
};

function BadgePill({ icon: Icon, label, value, tone = "info" }: PillProps) {
  const toneClasses =
    tone === "positive"
      ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30"
      : tone === "warn"
        ? "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30"
        : "bg-blue-500/15 text-blue-200 ring-1 ring-blue-500/30";
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
        toneClasses
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="uppercase tracking-[0.15em]">{label}</span>
      <span className="text-white/90">{value}</span>
    </div>
  );
}
