"use client";

import { memo } from "react";

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

function formatTime(value?: string | null): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export const EventsTable = memo(function EventsTable({
  output,
}: {
  output: ChromeEventsOutput;
}) {
  if (output.error) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-foreground">
        <p className="font-medium">Chrome events unavailable</p>
        <p className="text-muted-foreground">{output.error}</p>
        {output.suggestion && (
          <p className="text-muted-foreground">{output.suggestion}</p>
        )}
      </div>
    );
  }

  const events = output.events ?? [];
  if (events.length === 0) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        No Chrome events returned for the current scope.
      </div>
    );
  }

  const rows = events.slice(0, 10);

  return (
    <div className="rounded-md border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <p className="text-sm font-medium text-foreground">
          Recent Chrome events
        </p>
        {output.nextPageToken && (
          <span className="text-xs text-muted-foreground">
            More available (page token: {output.nextPageToken})
          </span>
        )}
      </div>
      <div className="divide-y divide-border">
        {rows.map((event, index) => {
          const primary = event.events?.[0];
          return (
            <div
              key={event.id?.uniqueQualifier ?? `${index}`}
              className="grid grid-cols-1 gap-1 px-3 py-2 text-sm sm:grid-cols-4"
            >
              <div className="text-foreground">
                <p className="font-medium leading-tight">
                  {primary?.name ?? primary?.type ?? "Event"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {event.id?.uniqueQualifier ?? "n/a"}
                </p>
              </div>
              <div className="text-muted-foreground">
                <p className="text-xs uppercase tracking-wide">Time</p>
                <p className="text-foreground">{formatTime(event.id?.time)}</p>
              </div>
              <div className="text-muted-foreground">
                <p className="text-xs uppercase tracking-wide">Actor</p>
                <p className="text-foreground">
                  {event.actor?.email ?? event.actor?.profileId ?? "Unknown"}
                </p>
              </div>
              <div className="text-muted-foreground">
                <p className="text-xs uppercase tracking-wide">Details</p>
                <p className="text-foreground">{primary?.type ?? "—"}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
