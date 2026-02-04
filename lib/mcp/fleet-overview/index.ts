/**
 * Re-exports for fleet overview extraction and summarization.
 */

export { extractFleetOverviewFacts } from "./extract";
export { buildFallbackOverview, summarizeFleetOverview } from "./summarize";
export type {
  FleetKnowledgeContext,
  FleetOverviewFacts,
  FleetOverviewFallback,
  PostureCard,
  Suggestion,
} from "./types";
