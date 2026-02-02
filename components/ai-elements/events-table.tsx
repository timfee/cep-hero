"use client";

import { AlertTriangle, Activity, InfoIcon } from "lucide-react";
import { memo } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TOOLTIPS } from "@/lib/terminology";
import { cn } from "@/lib/utils";

type EventParameter = {
  name?: string;
  value?: string;
  intValue?: string;
  boolValue?: boolean;
  multiValue?: string[];
};

type ChromeEvent = {
  id?: { time?: string | null; uniqueQualifier?: string | null };
  actor?: { email?: string | null; profileId?: string | null };
  events?: Array<{
    name?: string | null;
    type?: string | null;
    parameters?: EventParameter[];
  }>;
};

type ChromeEventsOutput = {
  events?: ChromeEvent[];
  nextPageToken?: string | null;
  error?: string;
  suggestion?: string;
};

function formatShortDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function humanizeEventName(name?: string | null): string {
  if (!name) return "Unknown Event";
  return name
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const NOTABLE_EVENT_NAMES = [
  "MALWARE_TRANSFER",
  "PASSWORD_BREACH",
  "SENSITIVE_DATA_TRANSFER",
  "CONTENT_TRANSFER",
  "URL_FILTERING",
  "EXTENSION_REQUEST",
  "LOGIN_FAILURE",
  "UNSAFE_SITE_VISIT",
  "PASSWORD_REUSE",
] as const;

const NOTABLE_RESULTS = ["BLOCKED", "QUARANTINED", "DENIED"] as const;

function isNotableEvent(event: ChromeEvent): boolean {
  const primary = event.events?.[0];
  if (!primary) return false;

  const eventName = primary.name?.toUpperCase() ?? "";
  if (
    NOTABLE_EVENT_NAMES.some((name) => eventName.includes(name.toUpperCase()))
  ) {
    return true;
  }

  const resultParam = primary.parameters?.find(
    (p) => p.name === "EVENT_RESULT"
  );
  if (
    resultParam?.value &&
    NOTABLE_RESULTS.includes(
      resultParam.value.toUpperCase() as (typeof NOTABLE_RESULTS)[number]
    )
  ) {
    return true;
  }

  return false;
}

function isErrorEvent(type?: string | null): boolean {
  if (!type) return false;
  const errorPatterns = [
    "FAILURE",
    "ERROR",
    "BREACH",
    "MALWARE",
    "BLOCKED",
    "DENIED",
    "VIOLATION",
  ];
  return errorPatterns.some((pattern) => type.toUpperCase().includes(pattern));
}

export const EventsTable = memo(function EventsTable({
  output,
}: {
  output: ChromeEventsOutput;
}) {
  if (output.error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
        <p className="text-sm font-medium text-destructive">
          Unable to load activity
        </p>
        <p className="mt-1 text-sm text-foreground/80">{output.error}</p>
        {output.suggestion && (
          <p className="mt-1 text-sm text-foreground/70">{output.suggestion}</p>
        )}
      </div>
    );
  }

  const events = output.events ?? [];
  if (events.length === 0) {
    return (
      <div className="rounded-md border border-border bg-muted/50 p-4 text-center">
        <Activity className="mx-auto h-6 w-6 text-foreground/50" />
        <p className="mt-1 text-sm text-foreground/70">No recent activity</p>
      </div>
    );
  }

  const rows = events.slice(0, 15);

  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-foreground/70" />
          <span className="text-sm font-medium text-foreground">
            Recent Activity
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <InfoIcon className="h-3 w-3 cursor-help text-foreground/50" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>{TOOLTIPS.chromeEvents}</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <span className="text-xs text-foreground/60">
          {rows.length}/{events.length}
        </span>
      </div>

      <div role="list">
        {rows.map((event, index) => {
          const primary = event.events?.[0];
          const actor = event.actor?.email ?? event.actor?.profileId;
          const notable = isNotableEvent(event);
          const isError = isErrorEvent(primary?.type);
          const signalCount = event.events?.length ?? 0;

          return (
            <div
              key={event.id?.uniqueQualifier ?? `event-${index}`}
              role="listitem"
              className={cn(
                "flex items-center gap-2 border-b border-border/50 px-3 py-1.5 last:border-b-0",
                notable && "bg-amber-500/10",
                isError && !notable && "bg-destructive/5"
              )}
            >
              {notable ? (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              ) : (
                <Activity
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    isError ? "text-destructive/70" : "text-foreground/40"
                  )}
                />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "truncate text-sm font-medium",
                      notable ? "text-amber-400" : "text-foreground"
                    )}
                  >
                    {humanizeEventName(primary?.name ?? primary?.type)}
                  </span>
                  {notable && (
                    <span className="shrink-0 rounded bg-amber-500/20 px-1 py-0.5 text-[10px] font-semibold uppercase text-amber-400">
                      Alert
                    </span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 text-xs text-foreground/60">
                {actor && (
                  <span className="max-w-[120px] truncate">{actor}</span>
                )}
                <span className="tabular-nums">
                  {formatShortDate(event.id?.time)}
                </span>
                {signalCount > 1 && (
                  <span className="rounded bg-foreground/10 px-1 text-[10px]">
                    {signalCount}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
