"use client";

import { ArrowRight } from "lucide-react";
import useSWR from "swr";

import { cn } from "@/lib/utils";

import { EntityName } from "./entity-name";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type ConnectorStatus = {
  id: string;
  name: string;
  status: "healthy" | "degraded" | "error" | "offline";
  issues: string[];
};

type SuggestedAction = {
  id: string;
  description: string;
  command: string;
  parameters?: Record<string, string>;
  severity: "critical" | "high" | "medium" | "low";
  impact?: string;
};

type OverviewData = {
  headline: string;
  summary: string;
  connectors: ConnectorStatus[];
  suggestedActions: SuggestedAction[];
};

type DashboardOverviewProps = {
  onAction: (command: string, parameters?: Record<string, string>) => void;
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

  const unhealthyConnectors = (data.connectors || []).filter(
    (c) => c.status !== "healthy"
  );
  const hasIssues =
    unhealthyConnectors.length > 0 || (data.suggestedActions || []).length > 0;

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
            {unhealthyConnectors.length > 0 && (
              <section>
                <h2 className="mb-6 text-sm font-medium text-muted-foreground">
                  Needs attention
                </h2>
                <div className="space-y-3">
                  {unhealthyConnectors.map((connector) => (
                    <button
                      key={connector.id}
                      type="button"
                      onClick={() =>
                        onAction("diagnoseConnector", {
                          connectorId: connector.id,
                        })
                      }
                      className={cn(
                        "group flex w-full items-center justify-between rounded-2xl p-6 text-left",
                        "border border-white/10 bg-white/[0.04] backdrop-blur-xl",
                        "transition-all duration-200",
                        "hover:border-white/15 hover:bg-white/[0.08]"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <span
                          className={cn(
                            "h-2.5 w-2.5 rounded-full",
                            connector.status === "degraded" &&
                              "bg-(--color-status-warning)",
                            connector.status === "error" &&
                              "bg-(--color-status-error)",
                            connector.status === "offline" &&
                              "bg-muted-foreground"
                          )}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <EntityName>{connector.name}</EntityName>
                            <span className="text-muted-foreground">
                              is {connector.status}
                            </span>
                          </div>
                          {connector.issues[0] && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {connector.issues[0]}
                            </p>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {(data.suggestedActions || []).length > 0 && (
              <section>
                <h2 className="mb-6 text-sm font-medium text-muted-foreground">
                  Suggested actions
                </h2>
                <div className="space-y-3">
                  {data.suggestedActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() =>
                        onAction(action.command, action.parameters)
                      }
                      className={cn(
                        "group flex w-full items-center justify-between rounded-2xl p-6 text-left",
                        "border border-white/10 bg-white/[0.04] backdrop-blur-xl",
                        "transition-all duration-200",
                        "hover:border-white/15 hover:bg-white/[0.08]"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <span
                          className={cn(
                            "h-2.5 w-2.5 rounded-full",
                            action.severity === "critical" &&
                              "bg-(--color-status-error)",
                            action.severity === "high" &&
                              "bg-(--color-status-warning)",
                            action.severity === "medium" &&
                              "bg-(--color-status-info)",
                            action.severity === "low" && "bg-muted-foreground"
                          )}
                        />
                        <div>
                          <p className="text-foreground">
                            {action.description}
                          </p>
                          {action.impact && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {action.impact}
                            </p>
                          )}
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
              <span className="h-3 w-3 rounded-full bg-(--color-status-healthy)" />
            </div>
            <p className="text-foreground">All systems healthy</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No issues require your attention
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
