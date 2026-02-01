"use client";

import { Check, Copy, AlertTriangle, Shield } from "lucide-react";
import { useState } from "react";

type EventParam = { name?: string; value?: string };
type ChromeEventDetail = { name?: string; parameters?: EventParam[] };
type ChromeEvent = {
  actor?: { email?: string };
  id?: { time?: string };
  events?: ChromeEventDetail[];
};
type DlpRule = {
  id?: string;
  displayName?: string;
  resourceName?: string;
  description?: string;
  consoleUrl?: string;
};

/**
 * Pull a parameter value from a Chrome event detail.
 */
function extractParam(
  detail: ChromeEventDetail | undefined,
  key: string
): string | null {
  const params = detail?.parameters ?? [];
  const hit = params.find((param) => param.name === key);
  return hit?.value ?? null;
}

/**
 * Return the most frequent value in a list.
 */
function topCount<T>(items: T[], keyFn: (item: T) => string | null) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  return sorted[0] ? { value: sorted[0][0], count: sorted[0][1] } : null;
}

/**
 * Summarize common detector types.
 */
function summarizeDetector(detector?: string | null) {
  if (!detector) return null;
  const name = detector.toUpperCase();
  if (name.includes("PHONE")) return "Phone number detector matched";
  if (name.includes("SSN")) return "SSN detector matched";
  if (name.includes("CREDIT")) return "Credit card detector matched";
  if (name.includes("PASSPORT")) return "Passport number detector matched";
  if (name.includes("PII")) return "PII detector matched";
  return `Detector matched: ${detector}`;
}

export function EventsTable({ events }: { events: ChromeEvent[] }) {
  if (events.length === 0) {
    return <div className="text-zinc-500 italic">No recent events found.</div>;
  }

  const latest = events[0];
  const latestEvent = latest?.events?.[0];
  const latestUrl = extractParam(latestEvent, "url");
  const latestType = latestEvent?.name;
  const latestTime = latest?.id?.time;
  const latestTimestamp = latestTime
    ? new Date(latestTime).toLocaleString()
    : null;
  const recentActors = Array.from(
    new Set(events.map((evt) => evt.actor?.email).filter(Boolean))
  ).slice(0, 5);
  const detector =
    extractParam(latestEvent, "detector_name") ||
    extractParam(latestEvent, "detectorId") ||
    extractParam(latestEvent, "detector_id");
  const contentName =
    extractParam(latestEvent, "content_name") ||
    extractParam(latestEvent, "file_name") ||
    extractParam(latestEvent, "content_hash");
  const domain = (() => {
    try {
      return latestUrl ? new URL(latestUrl).hostname : null;
    } catch {
      return null;
    }
  })();
  const trigger = extractParam(latestEvent, "trigger_type") || latestType;

  const topEvent = topCount(events, (evt) => evt.events?.[0]?.name ?? null);
  const topDomain = topCount(events, (evt) => {
    const url = extractParam(evt.events?.[0], "url");
    if (!url) return null;
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  });

  const detectorInsight = summarizeDetector(detector);

  const insightLines = [
    `${events.length} recent events`,
    topEvent ? `Top event: ${topEvent.value} (${topEvent.count})` : null,
    topDomain ? `Top domain: ${topDomain.value} (${topDomain.count})` : null,
    recentActors.length ? `Actors: ${recentActors.join(", ")}` : null,
    detectorInsight,
    contentName ? `Content: ${contentName}` : null,
    domain ? `Latest domain: ${domain}` : null,
    trigger ? `Trigger: ${trigger}` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-200">
        <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          Summary
        </div>
        <div className="mt-2 space-y-1 text-sm text-zinc-200">
          {insightLines.map((line, idx) => (
            <div key={idx} className="text-zinc-300">
              {line}
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-400">
          {latestUrl ? (
            <a
              className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-blue-300 hover:text-blue-200"
              href={latestUrl}
              target="_blank"
              rel="noopener"
            >
              Open latest URL
            </a>
          ) : null}
          {latestTimestamp ? (
            <span className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1">
              Time: {latestTimestamp}
            </span>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/50">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-900/80 text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-medium">Event</th>
              <th className="px-4 py-3 font-medium">Actor</th>
              <th className="px-4 py-3 font-medium">Resource</th>
              <th className="px-4 py-3 font-medium">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {events.map((evt, i) => {
              const detail = evt.events?.[0];
              const params = detail?.parameters ?? [];
              const url = params.find((param) => param.name === "url")?.value;
              const host = (() => {
                try {
                  return url ? new URL(url).hostname : null;
                } catch {
                  return null;
                }
              })();
              const user = evt.actor?.email;
              const ts = evt.id?.time;

              return (
                <tr key={i} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-zinc-200">
                    <div className="flex flex-col gap-1">
                      <span>{detail?.name || "Unknown"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {user || "System"}
                  </td>
                  <td
                    className="px-4 py-3 text-zinc-400 max-w-[180px] truncate"
                    title={url}
                  >
                    {host ? (
                      <div className="flex flex-col gap-1">
                        <span>{host}</span>
                        {url ? (
                          <a
                            className="text-blue-300 hover:text-blue-200"
                            href={url}
                            target="_blank"
                            rel="noopener"
                          >
                            Open URL
                          </a>
                        ) : null}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-[11px]">
                    {ts ? new Date(ts).toLocaleString() : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RuleCard({ rule }: { rule: DlpRule }) {
  const title = rule.displayName || rule.id || "DLP rule";
  const resource = rule.resourceName || "";

  return (
    <div className="flex items-start justify-between rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 transition-all hover:bg-zinc-900/50">
      <div className="flex gap-3">
        <div className="mt-1 rounded-full bg-blue-500/10 p-2">
          <Shield className="h-4 w-4 text-blue-500" />
        </div>
        <div>
          <h4 className="text-sm font-medium text-zinc-200">{title}</h4>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm">
            {rule.description || "No description provided yet."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-zinc-400">
            <span className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5">
              ID
              <span className="font-medium text-zinc-200">{rule.id}</span>
            </span>
            {resource ? (
              <span className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5">
                Resource
                <span className="font-medium text-zinc-200">{resource}</span>
              </span>
            ) : null}
          </div>
          {rule.consoleUrl ? (
            <a
              href={rule.consoleUrl}
              target="_blank"
              rel="noopener"
              className="mt-3 inline-flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300"
            >
              Open in Admin Console
            </a>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        <span className="text-xs font-medium text-emerald-500">Active</span>
      </div>
    </div>
  );
}

export function EnrollmentToken({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="group relative overflow-hidden rounded-xl border border-blue-500/20 bg-blue-500/5 p-6">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl transition-all group-hover:bg-blue-500/20" />

      <div className="relative">
        <h4 className="text-xs font-medium uppercase tracking-wider text-blue-400">
          Enrollment Token
        </h4>
        <div className="mt-3 flex items-center gap-3">
          <code className="flex-1 rounded-lg border border-blue-500/20 bg-black/20 px-4 py-3 font-mono text-lg font-bold tracking-widest text-white">
            {token}
          </code>
          <button
            onClick={handleCopy}
            className="flex h-12 w-12 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-400 transition-colors hover:bg-blue-500/20 hover:text-blue-300"
          >
            {copied ? (
              <Check className="h-5 w-5" />
            ) : (
              <Copy className="h-5 w-5" />
            )}
          </button>
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs text-zinc-400">
          <AlertTriangle className="h-3 w-3 text-amber-500" />
          Expires in 30 days. Use this to enroll devices in Chrome Admin
          Console.
        </p>
      </div>
    </div>
  );
}
