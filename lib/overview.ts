/**
 * Overview data types and utilities for the CEP Hero dashboard.
 */

export type PostureCardStatus = "healthy" | "warning" | "critical" | "info";

export interface OverviewCard {
  label: string;
  value: string;
  note: string;
  source: string;
  action: string;
  lastUpdated?: string;
  status?: PostureCardStatus;
  progress?: number;
  priority?: number;
}

export type SuggestionCategory =
  | "security"
  | "compliance"
  | "monitoring"
  | "optimization";

export interface Suggestion {
  text: string;
  action: string;
  priority: number;
  category: SuggestionCategory;
}

export interface OverviewData {
  headline: string;
  summary: string;
  postureCards: OverviewCard[];
  suggestions: Suggestion[];
  sources: string[];
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const DOMAIN_RE =
  /\b(?!(?:localhost|local|example|example\.com)\b)(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s)]+/gi;
function redactSensitive(text: string): string {
  return text
    .replace(URL_RE, "[redacted]")
    .replace(EMAIL_RE, "[redacted]")
    .replace(DOMAIN_RE, "[redacted]");
}

function sanitizeOverviewText(text: string): string {
  return redactSensitive(text).trim();
}

function sanitizeHeadline(text: string): string {
  const redacted = redactSensitive(text);
  return redacted.trim();
}

function sanitizeSuggestion(suggestion: Suggestion): Suggestion {
  return {
    ...suggestion,
    text: sanitizeOverviewText(suggestion.text),
    action: redactSensitive(suggestion.action),
  };
}

function sanitizePostureCard(card: OverviewCard): OverviewCard {
  return {
    ...card,
    label: redactSensitive(card.label),
    value: redactSensitive(card.value),
    note: sanitizeOverviewText(card.note),
    action: redactSensitive(card.action),
    source: redactSensitive(card.source),
  };
}

export function sanitizeOverview(data: OverviewData): OverviewData {
  return {
    ...data,
    headline: sanitizeHeadline(data.headline),
    summary: sanitizeOverviewText(data.summary),
    postureCards: data.postureCards.map((card) => sanitizePostureCard(card)),
    suggestions: data.suggestions.map((suggestion) =>
      sanitizeSuggestion(suggestion)
    ),
    sources: data.sources.map((source) => redactSensitive(source)),
  };
}

export const DEFAULT_SUGGESTIONS: Suggestion[] = [
  {
    text: "Set up a DLP audit rule to monitor all traffic for sensitive data",
    action: "Help me set up DLP to audit all traffic for sensitive data",
    priority: 1,
    category: "security",
  },
  {
    text: "Enable cookie encryption and disable incognito mode for better security",
    action: "Help me turn on cookie encryption and disable incognito mode",
    priority: 2,
    category: "security",
  },
  {
    text: "Review your connector policies to ensure data protection is active",
    action: "Review connector configuration",
    priority: 3,
    category: "compliance",
  },
  {
    text: "Check recent security events for any suspicious activity",
    action: "Show recent security events",
    priority: 4,
    category: "monitoring",
  },
];

export const QUICK_ACTIONS = [
  {
    label: "Set up DLP monitoring",
    description: "Audit all traffic for sensitive data",
  },
  {
    label: "Secure browsers",
    description: "Cookie encryption & disable incognito",
  },
  { label: "Review connectors", description: "Check data protection policies" },
  { label: "View security events", description: "Recent browser activity" },
] as const;

/**
 * Normalize and validate raw overview API response data.
 * Returns null if the data is invalid or missing required fields.
 */
export function normalizeOverview(data: unknown): OverviewData | null {
  if (!isRecord(data)) {
    return null;
  }

  const obj = data;

  const postureCards = Array.isArray(obj.postureCards)
    ? obj.postureCards.filter(isValidPostureCard)
    : [];

  const suggestions = Array.isArray(obj.suggestions)
    ? obj.suggestions.filter(isValidSuggestion)
    : [];

  const normalized: OverviewData = {
    headline: typeof obj.headline === "string" ? obj.headline : "Fleet posture",
    summary: typeof obj.summary === "string" ? obj.summary : "",
    postureCards,
    suggestions,
    sources: Array.isArray(obj.sources)
      ? obj.sources.filter((s) => typeof s === "string")
      : [],
  };

  return sanitizeOverview(normalized);
}

/**
 * Type guard for validating posture card structure.
 */
function isValidPostureCard(card: unknown): card is OverviewCard {
  if (!isRecord(card)) {
    return false;
  }
  const c = card;
  return (
    typeof c.label === "string" &&
    typeof c.value === "string" &&
    typeof c.note === "string" &&
    typeof c.source === "string" &&
    typeof c.action === "string"
  );
}

/**
 * Type guard for validating suggestion structure.
 */
function isValidSuggestion(suggestion: unknown): suggestion is Suggestion {
  if (!isRecord(suggestion)) {
    return false;
  }
  const s = suggestion;
  const validCategories = [
    "security",
    "compliance",
    "monitoring",
    "optimization",
  ] as const;
  return (
    typeof s.text === "string" &&
    typeof s.action === "string" &&
    typeof s.priority === "number" &&
    typeof s.category === "string" &&
    (validCategories as readonly string[]).includes(s.category)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Create default overview data when API fails or returns invalid data.
 */
export function createDefaultOverview(): OverviewData {
  return sanitizeOverview({
    headline: "Fleet posture",
    summary: "",
    postureCards: [],
    suggestions: [...DEFAULT_SUGGESTIONS],
    sources: [],
  });
}
