"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { EntityName } from "./entity-name";

type ToolOutputProps = {
  toolName: string;
  state: string;
  output?: unknown;
  onAction?: (command: string) => void;
};

export function ToolOutput({
  toolName,
  state,
  output,
  onAction,
}: ToolOutputProps) {
  if (state === "input-streaming" || state === "input-available") {
    return (
      <div className="flex items-center gap-3 py-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-(--color-status-info)" />
        <span className="text-muted-foreground">
          {formatToolName(toolName)}...
        </span>
      </div>
    );
  }

  if (state === "output-error") {
    return (
      <div className="flex items-center gap-3 py-2">
        <span className="h-2 w-2 rounded-full bg-(--color-status-error)" />
        <span className="text-muted-foreground">
          Failed to {formatToolName(toolName).toLowerCase()}
        </span>
      </div>
    );
  }

  if (!output) return null;

  switch (toolName) {
    case "getFleetOverview":
      return <FleetOverviewOutput data={output} />;
    case "getChromeConnectorConfiguration":
      return <ConnectorStatusOutput data={output} onAction={onAction} />;
    case "listDLPRules":
      return <DLPRulesOutput data={output} onAction={onAction} />;
    case "getChromeEvents":
      return <EventsOutput data={output} />;
    case "runDiagnosis":
      return <DiagnoseOutput data={output} onAction={onAction} />;
    case "enrollBrowser":
      return <EnrollOutput data={output} />;
    case "suggestActions":
      return <SuggestActionsOutput data={output} onAction={onAction} />;
    default:
      return null;
  }
}

function formatToolName(name: string): string {
  const formatted = name.replace(/([A-Z])/g, " $1").trim();
  return formatted.charAt(0).toUpperCase() + formatted.slice(1).toLowerCase();
}

type ActionButtonProps = {
  children: ReactNode;
  onClick: () => void;
  variant?: "default" | "primary" | "danger";
};

function ActionButton({
  children,
  onClick,
  variant = "default",
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-4 py-2.5 text-sm font-medium",
        "transition-all duration-150",
        variant === "default" &&
          "border-white/10 bg-white/[0.04] text-foreground hover:bg-white/[0.08]",
        variant === "primary" &&
          "border-primary/30 bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "danger" &&
          "border-red-500/30 bg-red-500/20 text-red-300 hover:bg-red-500/30"
      )}
    >
      {children}
    </button>
  );
}

type FleetData = {
  totalDevices?: number;
  managedDevices?: number;
  unmanagedDevices?: number;
  complianceRate?: number;
};

function FleetOverviewOutput({ data }: { data: unknown }) {
  const fleetData = data as FleetData;
  return (
    <div className="my-4 grid grid-cols-2 gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
      <div>
        <div className="text-sm text-muted-foreground">Total devices</div>
        <div className="mt-1 text-2xl font-semibold text-foreground">
          {fleetData.totalDevices?.toLocaleString()}
        </div>
      </div>
      <div>
        <div className="text-sm text-muted-foreground">Managed</div>
        <div className="mt-1 text-2xl font-semibold text-foreground">
          {fleetData.managedDevices?.toLocaleString()}
        </div>
      </div>
      <div>
        <div className="text-sm text-muted-foreground">Compliance</div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-2xl font-semibold text-foreground">
            {fleetData.complianceRate !== undefined
              ? `${fleetData.complianceRate}%`
              : "—"}
          </span>
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              (fleetData.complianceRate ?? 0) >= 95
                ? "bg-(--color-status-healthy)"
                : (fleetData.complianceRate ?? 0) >= 80
                  ? "bg-(--color-status-warning)"
                  : "bg-(--color-status-error)"
            )}
          />
        </div>
      </div>
      <div>
        <div className="text-sm text-muted-foreground">Unmanaged</div>
        <div className="mt-1 text-2xl font-semibold text-foreground">
          {fleetData.unmanagedDevices?.toLocaleString()}
        </div>
      </div>
    </div>
  );
}

type ConnectorData = {
  id: string;
  name: string;
  status: "healthy" | "degraded" | "error" | "offline";
};

type ConnectorsData = {
  connectors?: ConnectorData[];
  id?: string;
  name?: string;
  status?: "healthy" | "degraded" | "error" | "offline";
};

function ConnectorStatusOutput({
  data,
  onAction,
}: {
  data: unknown;
  onAction?: (cmd: string) => void;
}) {
  const connData = data as ConnectorsData;
  if (connData.connectors) {
    return (
      <div className="my-3 space-y-2">
        {connData.connectors.map((conn) => (
          <div
            key={conn.id}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  conn.status === "healthy" && "bg-(--color-status-healthy)",
                  conn.status === "degraded" && "bg-(--color-status-warning)",
                  conn.status === "error" && "bg-(--color-status-error)",
                  conn.status === "offline" && "bg-muted-foreground"
                )}
              />
              <EntityName>{conn.name}</EntityName>
            </div>
            {conn.status !== "healthy" && onAction && (
              <ActionButton
                onClick={() => onAction(`diagnose connector ${conn.id}`)}
              >
                Diagnose
              </ActionButton>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="my-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full",
          connData.status === "healthy" && "bg-(--color-status-healthy)",
          connData.status === "degraded" && "bg-(--color-status-warning)",
          connData.status === "error" && "bg-(--color-status-error)",
          connData.status === "offline" && "bg-muted-foreground"
        )}
      />
      <EntityName>{connData.name}</EntityName>
    </div>
  );
}

type DLPRule = {
  id: string;
  name: string;
  enabled: boolean;
  triggerCount: number;
};

type DLPRulesData = {
  rules?: DLPRule[];
};

function DLPRulesOutput({
  data,
  onAction,
}: {
  data: unknown;
  onAction?: (cmd: string) => void;
}) {
  const dlpData = data as DLPRulesData;
  if (!dlpData?.rules) return null;

  return (
    <div className="my-3 space-y-2">
      {dlpData.rules.map((rule) => (
        <div
          key={rule.id}
          className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl"
        >
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                rule.enabled
                  ? "bg-(--color-status-healthy)"
                  : "bg-muted-foreground"
              )}
            />
            <EntityName>{rule.name}</EntityName>
            <span className="text-sm text-muted-foreground">
              {rule.triggerCount} triggers
            </span>
          </div>
          {onAction && (
            <ActionButton
              onClick={() =>
                onAction(
                  rule.enabled
                    ? `disable rule ${rule.id}`
                    : `enable rule ${rule.id}`
                )
              }
            >
              {rule.enabled ? "Disable" : "Enable"}
            </ActionButton>
          )}
        </div>
      ))}
    </div>
  );
}

type EventData = {
  id: string;
  message: string;
  timestamp: string;
};

type EventsData = {
  events?: EventData[];
};

function EventsOutput({ data }: { data: unknown }) {
  const eventsData = data as EventsData;
  if (!eventsData?.events) return null;

  return (
    <div className="my-3 space-y-2">
      {eventsData.events.slice(0, 5).map((event) => (
        <div
          key={event.id}
          className="rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl"
        >
          <p className="text-foreground">{event.message}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(event.timestamp).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}

type DiagnoseCheck = {
  name: string;
  status: "pass" | "fail" | "warning";
  message?: string;
};

type SuggestedAction = {
  label: string;
  command: string;
};

type DiagnoseData = {
  state?: string;
  message?: string;
  error?: string;
  connector?: string;
  checks?: DiagnoseCheck[];
  suggestedActions?: SuggestedAction[];
};

function DiagnoseOutput({
  data,
  onAction,
}: {
  data: unknown;
  onAction?: (cmd: string) => void;
}) {
  const diagData = data as DiagnoseData;

  if (diagData.state && diagData.state !== "complete") {
    return (
      <div className="flex items-center gap-3 py-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-(--color-status-info)" />
        <span className="text-muted-foreground">{diagData.message}</span>
      </div>
    );
  }

  if (diagData.error) {
    return (
      <div className="flex items-center gap-3 py-2">
        <span className="h-2 w-2 rounded-full bg-(--color-status-error)" />
        <span className="text-muted-foreground">{diagData.error}</span>
      </div>
    );
  }

  return (
    <div className="my-4 rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-muted-foreground">Diagnostics for</span>
        <EntityName>{diagData.connector}</EntityName>
      </div>

      {diagData.checks && diagData.checks.length > 0 && (
        <div className="space-y-2">
          {diagData.checks.map((check, i) => (
            <div key={i} className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full",
                  check.status === "pass" && "bg-(--color-status-healthy)",
                  check.status === "fail" && "bg-(--color-status-error)",
                  check.status === "warning" && "bg-(--color-status-warning)"
                )}
              />
              <div>
                <div className="text-foreground">{check.name}</div>
                {check.message && (
                  <div className="text-sm text-muted-foreground">
                    {check.message}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {diagData.suggestedActions &&
        diagData.suggestedActions.length > 0 &&
        onAction && (
          <div className="mt-5 flex flex-wrap gap-3 border-t border-white/10 pt-5">
            {diagData.suggestedActions.map((action, i) => (
              <ActionButton key={i} onClick={() => onAction(action.command)}>
                {action.label}
              </ActionButton>
            ))}
          </div>
        )}
    </div>
  );
}

type EnrollData = {
  enrollmentToken?: string;
  token?: string;
  expiresIn?: string;
};

function EnrollOutput({ data }: { data: unknown }) {
  const enrollData = data as EnrollData;
  return (
    <div className="my-4 rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
      <div className="mb-3 text-sm text-muted-foreground">
        Enrollment token generated
      </div>
      <code className="block rounded-lg bg-white/[0.06] px-4 py-3 font-mono text-sm text-foreground">
        {enrollData.enrollmentToken || enrollData.token}
      </code>
      <p className="mt-3 text-sm text-muted-foreground">
        Expires in {enrollData.expiresIn || "24 hours"}
      </p>
    </div>
  );
}

type SuggestActionsData = {
  actions?: string[];
};

function SuggestActionsOutput({
  data,
  onAction,
}: {
  data: unknown;
  onAction?: (cmd: string) => void;
}) {
  const actionsData = data as SuggestActionsData;
  if (!actionsData?.actions || actionsData.actions.length === 0) return null;

  return (
    <div className="my-3 flex flex-wrap gap-2">
      {actionsData.actions.map((action, i) => (
        <ActionButton key={i} onClick={() => onAction?.(action)}>
          {action}
        </ActionButton>
      ))}
    </div>
  );
}
