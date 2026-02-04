/**
 * Extracts deterministic fleet signals from raw API tool outputs.
 */

import { type FleetOverviewFacts } from "./types";

/**
 * Chrome event parameter shape.
 */
interface EventParameter {
  name?: string;
  value?: string;
}

/**
 * Chrome event detail shape.
 */
interface EventDetail {
  type?: string;
  parameters?: EventParameter[];
}

/**
 * Chrome event shape from audit logs.
 */
interface ChromeEvent {
  id?: { time?: string };
  events?: EventDetail[];
}

/**
 * Parses raw event data into typed ChromeEvent objects.
 */
function parseEvents(raw: unknown[]) {
  return raw.filter(isChromeEvent);
}

/**
 * Type guard for ChromeEvent objects.
 */
function isChromeEvent(value: unknown): value is ChromeEvent {
  return typeof value === "object" && value !== null;
}

/**
 * Result shape from the Chrome events API.
 */
interface EventsResult {
  events?: unknown[];
  nextPageToken?: string | null;
  error?: string;
}

/**
 * Summary of a window of Chrome events.
 */
interface EventsWindowSummary {
  events: EventsResult;
  totalCount: number;
  sampled: boolean;
  windowStart: Date;
  windowEnd: Date;
}

/**
 * Result shape from the DLP rules API.
 */
interface DlpResult {
  rules?: unknown[];
  error?: string;
}

/**
 * Result shape from the connector config API.
 */
interface ConnectorResult {
  value?: unknown[];
  error?: string;
}

const BLOCKED_RESULTS = new Set(["BLOCKED", "DENIED", "QUARANTINED"]);
const ERROR_PATTERNS = [
  "FAILURE",
  "ERROR",
  "BREACH",
  "MALWARE",
  "BLOCKED",
  "DENIED",
  "VIOLATION",
];

/**
 * Extracts API errors from result objects.
 */
function extractErrors(
  eventsResult: EventsResult,
  dlpResult: DlpResult,
  connectorResult: ConnectorResult
) {
  const errors: string[] = [];

  if (typeof eventsResult.error === "string" && eventsResult.error.length > 0) {
    errors.push(`Chrome events: ${eventsResult.error}`);
  }
  if (typeof dlpResult.error === "string" && dlpResult.error.length > 0) {
    errors.push(`DLP rules: ${dlpResult.error}`);
  }
  if (
    typeof connectorResult.error === "string" &&
    connectorResult.error.length > 0
  ) {
    errors.push(`Connector policies: ${connectorResult.error}`);
  }

  return errors;
}

/**
 * Counts blocked and error events in a list of Chrome events.
 */
function countBlockedAndErrorEvents(events: ChromeEvent[]) {
  let blockedCount = 0;
  let errorCount = 0;

  for (const event of events) {
    const { blocked, hasError } = analyzeEvent(event);
    if (blocked) {
      blockedCount += 1;
    }
    if (hasError) {
      errorCount += 1;
    }
  }

  return { blockedCount, errorCount };
}

/**
 * Analyzes a single event for blocked status and error indicators.
 */
function analyzeEvent(event: ChromeEvent) {
  const primary = event.events?.[0];
  const resultValue = extractEventResult(primary);
  const blocked =
    resultValue !== null && BLOCKED_RESULTS.has(resultValue.toUpperCase());
  const hasError = isErrorEventType(primary?.type);

  return { blocked, hasError };
}

/**
 * Extracts the EVENT_RESULT parameter value from an event.
 */
function extractEventResult(primary: EventDetail | undefined) {
  const resultParam = primary?.parameters?.find(
    (param: EventParameter) => param.name === "EVENT_RESULT"
  );
  return typeof resultParam?.value === "string" ? resultParam.value : null;
}

/**
 * Checks if an event type matches known error patterns.
 */
function isErrorEventType(type: string | undefined) {
  if (type === undefined) {
    return false;
  }
  const upperType = type.toUpperCase();
  return ERROR_PATTERNS.some((pattern) => upperType.includes(pattern));
}

/**
 * Calculates a human-readable label for the event time window.
 */
function calculateWindowLabel(windowStart: Date, windowEnd: Date) {
  const windowDays = Math.max(
    1,
    Math.round((windowEnd.getTime() - windowStart.getTime()) / 86_400_000)
  );
  return `${windowDays} day${windowDays === 1 ? "" : "s"}`;
}

/**
 * Extracts deterministic fleet signals from tool outputs.
 */
export function extractFleetOverviewFacts(
  eventsResult: EventsWindowSummary,
  dlpResult: DlpResult,
  connectorResult: ConnectorResult
): FleetOverviewFacts {
  const rawEvents = eventsResult.events.events ?? [];
  const events = parseEvents(rawEvents);
  const rules = dlpResult.rules ?? [];
  const connectorValue = connectorResult.value ?? [];
  const errors = extractErrors(eventsResult.events, dlpResult, connectorResult);
  const { blockedCount, errorCount } = countBlockedAndErrorEvents(events);
  const latestEventAt =
    events.length > 0 ? (events[0]?.id?.time ?? null) : null;
  const eventWindowLabel = calculateWindowLabel(
    eventsResult.windowStart,
    eventsResult.windowEnd
  );

  return {
    eventCount: eventsResult.totalCount,
    blockedEventCount: blockedCount,
    errorEventCount: errorCount,
    dlpRuleCount: rules.length,
    connectorPolicyCount: connectorValue.length,
    latestEventAt,
    eventWindowLabel,
    eventSampled: eventsResult.sampled,
    eventSampleCount: events.length,
    errors,
  };
}
