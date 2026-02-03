import { type FleetOverviewFacts } from "./types";

interface EventParameter {
  name?: string;
  value?: string;
}

interface EventDetail {
  type?: string;
  parameters?: EventParameter[];
}

interface ChromeEvent {
  id?: { time?: string };
  events?: EventDetail[];
}

function parseEvents(raw: unknown[]): ChromeEvent[] {
  return raw.filter(isChromeEvent);
}

function isChromeEvent(value: unknown): value is ChromeEvent {
  return typeof value === "object" && value !== null;
}

interface EventsResult {
  events?: unknown[];
  nextPageToken?: string | null;
  error?: string;
}

interface EventsWindowSummary {
  events: EventsResult;
  totalCount: number;
  sampled: boolean;
  windowStart: Date;
  windowEnd: Date;
}

interface DlpResult {
  rules?: unknown[];
  error?: string;
}

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

function extractErrors(
  eventsResult: EventsResult,
  dlpResult: DlpResult,
  connectorResult: ConnectorResult
): string[] {
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

function countBlockedAndErrorEvents(events: ChromeEvent[]): {
  blockedCount: number;
  errorCount: number;
} {
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

function analyzeEvent(event: ChromeEvent): {
  blocked: boolean;
  hasError: boolean;
} {
  const primary = event.events?.[0];
  const resultValue = extractEventResult(primary);
  const blocked =
    resultValue !== null && BLOCKED_RESULTS.has(resultValue.toUpperCase());
  const hasError = isErrorEventType(primary?.type);

  return { blocked, hasError };
}

function extractEventResult(primary: EventDetail | undefined): string | null {
  const resultParam = primary?.parameters?.find(
    (param: EventParameter) => param.name === "EVENT_RESULT"
  );
  return typeof resultParam?.value === "string" ? resultParam.value : null;
}

function isErrorEventType(type: string | undefined): boolean {
  if (type === undefined) {
    return false;
  }
  const upperType = type.toUpperCase();
  return ERROR_PATTERNS.some((pattern) => upperType.includes(pattern));
}

function calculateWindowLabel(windowStart: Date, windowEnd: Date): string {
  const windowDays = Math.max(
    1,
    Math.round((windowEnd.getTime() - windowStart.getTime()) / 86_400_000)
  );
  return `${windowDays} day${windowDays === 1 ? "" : "s"}`;
}

/**
 * Extract deterministic fleet signals from tool outputs.
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
