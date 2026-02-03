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
  if (!data || typeof data !== "object") {
    return null;
  }

  const obj = data as Record<string, unknown>;

  const postureCards = Array.isArray(obj.postureCards)
    ? (obj.postureCards as OverviewCard[]).filter(isValidPostureCard)
    : [];

  const suggestions = Array.isArray(obj.suggestions)
    ? (obj.suggestions as Suggestion[]).filter(isValidSuggestion)
    : [];

  return {
    headline: typeof obj.headline === "string" ? obj.headline : "Fleet posture",
    summary: typeof obj.summary === "string" ? obj.summary : "",
    postureCards,
    suggestions,
    sources: Array.isArray(obj.sources)
      ? (obj.sources as string[]).filter((s) => typeof s === "string")
      : [],
  };
}

/**
 * Type guard for validating posture card structure.
 */
function isValidPostureCard(card: unknown): card is OverviewCard {
  if (!card || typeof card !== "object") {
    return false;
  }
  const c = card as Record<string, unknown>;
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
  if (!suggestion || typeof suggestion !== "object") {
    return false;
  }
  const s = suggestion as Record<string, unknown>;
  const validCategories: SuggestionCategory[] = [
    "security",
    "compliance",
    "monitoring",
    "optimization",
  ];
  return (
    typeof s.text === "string" &&
    typeof s.action === "string" &&
    typeof s.priority === "number" &&
    typeof s.category === "string" &&
    validCategories.includes(s.category as SuggestionCategory)
  );
}

/**
 * Create default overview data when API fails or returns invalid data.
 */
export function createDefaultOverview(): OverviewData {
  return {
    headline: "Fleet posture",
    summary: "",
    postureCards: [],
    suggestions: [...DEFAULT_SUGGESTIONS],
    sources: [],
  };
}
