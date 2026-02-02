"use client";

import { Activity, Clock, InfoIcon, User } from "lucide-react";
import { memo } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TOOLTIPS } from "@/lib/terminology";

type ChromeEvent = {
  id?: { time?: string | null; uniqueQualifier?: string | null };
  actor?: { email?: string | null; profileId?: string | null };
  events?: Array<{ name?: string | null; type?: string | null }>;
};

type ChromeEventsOutput = {
  events?: ChromeEvent[];
  nextPageToken?: string | null;
  error?: string;
  suggestion?: string;
};

/**
 * Format timestamp as relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(value?: string | null): string {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60)
    return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
  if (diffHours < 24)
    return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

/**
 * Humanize event names (e.g., "DEVICE_BOOT" -> "Device Boot")
 */
function humanizeEventName(name?: string | null): string {
  if (!name) return "Unknown Event";
  return name
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Get a friendly description for event types
 */
function getEventDescription(type?: string | null): string {
  const descriptions: Record<string, string> = {
    DEVICE_BOOT: "Browser started on a managed device",
    EXTENSION_INSTALL: "Extension was installed",
    EXTENSION_UNINSTALL: "Extension was removed",
    LOGIN_EVENT: "User signed in",
    LOGOUT_EVENT: "User signed out",
    PASSWORD_BREACH: "Password found in data breach",
    MALWARE_TRANSFER: "Malware detected in file transfer",
    SENSITIVE_DATA_TRANSFER: "Sensitive data transfer detected",
    CONTENT_UNSCANNED: "Content could not be scanned",
    URL_FILTERING: "URL was filtered by policy",
    EXTENSION_REQUEST: "Extension installation requested",
  };
  return descriptions[type ?? ""] ?? "Browser activity recorded";
}

export const EventsTable = memo(function EventsTable({
  output,
}: {
  output: ChromeEventsOutput;
}) {
  if (output.error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
        <p className="font-medium text-destructive">Unable to load activity</p>
        <p className="mt-1 text-sm text-muted-foreground">{output.error}</p>
        {output.suggestion && (
          <p className="mt-2 text-sm text-muted-foreground">
            {output.suggestion}
          </p>
        )}
      </div>
    );
  }

  const events = output.events ?? [];
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-6 text-center">
        <Activity className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">
          No recent activity found
        </p>
      </div>
    );
  }

  const rows = events.slice(0, 10);

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <p className="font-medium text-foreground">Recent Activity</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <InfoIcon className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>{TOOLTIPS.chromeEvents}</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <span className="text-xs text-muted-foreground">
          {rows.length} of {events.length} events
        </span>
      </div>

      {/* Event list */}
      <div className="divide-y divide-border">
        {rows.map((event, index) => {
          const primary = event.events?.[0];
          const actor = event.actor?.email ?? event.actor?.profileId;

          return (
            <div
              key={event.id?.uniqueQualifier ?? `event-${index}`}
              className="flex items-start gap-4 px-4 py-4 transition-colors hover:bg-muted/30"
            >
              {/* Event icon */}
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Activity className="h-5 w-5 text-primary" />
              </div>

              {/* Event details */}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">
                  {humanizeEventName(primary?.name ?? primary?.type)}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {getEventDescription(primary?.type)}
                </p>

                {/* Meta info */}
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  {actor && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {actor}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(event.id?.time)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer with "more" indicator */}
      {output.nextPageToken && (
        <div className="border-t border-border px-4 py-3 text-center">
          <span className="text-xs text-muted-foreground">
            More activity available
          </span>
        </div>
      )}
    </div>
  );
});
