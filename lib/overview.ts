/**
 * Overview data types and utilities for the CEP Command Center dashboard.
 */

export type OverviewCard = {
  label: string;
  value: string;
  note: string;
  source: string;
  action: string;
  lastUpdated?: string;
};

export type OverviewData = {
  headline: string;
  summary: string;
  postureCards: OverviewCard[];
  suggestions: string[];
  sources: string[];
};

export const DEFAULT_SUGGESTIONS = [
  "Show recent Chrome events",
  "List connector policies and targets",
  "Check DLP rules and alerts",
  "Retry connector fetch",
] as const;

export const QUICK_ACTIONS = [
  { label: "Retry connector fetch", description: "Re-check connector status" },
  { label: "List connector policies", description: "View all policies" },
  { label: "Check org units", description: "Inspect OU structure" },
  { label: "Check auth scopes", description: "Verify permissions" },
] as const;

/**
 * Normalize and validate raw overview API response data.
 * Returns null if the data is invalid or missing required fields.
 */
export function normalizeOverview(data: unknown): OverviewData | null {
  if (!data || typeof data !== "object") return null;

  const obj = data as Record<string, unknown>;

  const postureCards = Array.isArray(obj.postureCards)
    ? (obj.postureCards as OverviewCard[]).filter(isValidPostureCard)
    : [];

  return {
    headline: typeof obj.headline === "string" ? obj.headline : "Fleet posture",
    summary: typeof obj.summary === "string" ? obj.summary : "",
    postureCards,
    suggestions: Array.isArray(obj.suggestions)
      ? (obj.suggestions as string[]).filter((s) => typeof s === "string")
      : [],
    sources: Array.isArray(obj.sources)
      ? (obj.sources as string[]).filter((s) => typeof s === "string")
      : [],
  };
}

/**
 * Type guard for validating posture card structure.
 */
function isValidPostureCard(card: unknown): card is OverviewCard {
  if (!card || typeof card !== "object") return false;
  const c = card as Record<string, unknown>;
  return (
    typeof c.label === "string" &&
    typeof c.value === "string" &&
    typeof c.action === "string"
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
