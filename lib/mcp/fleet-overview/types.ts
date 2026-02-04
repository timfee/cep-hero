/**
 * Type definitions for fleet overview extraction and summarization.
 */

import { type VectorSearchResult } from "@/lib/upstash/search";

/**
 * Knowledge context from vector search for AI summarization.
 */
export interface FleetKnowledgeContext {
  docs: VectorSearchResult | null;
  policies: VectorSearchResult | null;
}

/**
 * Deterministic facts extracted from fleet data.
 */
export interface FleetOverviewFacts {
  eventCount: number;
  blockedEventCount: number;
  errorEventCount: number;
  dlpRuleCount: number;
  connectorPolicyCount: number;
  latestEventAt: string | null;
  eventWindowLabel: string;
  eventSampled: boolean;
  eventSampleCount: number;
  errors: string[];
}

/**
 * A single posture card displayed in the fleet overview.
 */
export interface PostureCard {
  label: string;
  value: string;
  note: string;
  source: string;
  action: string;
  lastUpdated?: string;
  status?: "healthy" | "warning" | "critical" | "info";
  progress?: number;
  priority?: number;
}

/**
 * An actionable suggestion for improving fleet posture.
 */
export interface Suggestion {
  text: string;
  action: string;
  priority: number;
  category: "security" | "compliance" | "monitoring" | "optimization";
}

/**
 * Fallback overview structure when AI summarization fails.
 */
export interface FleetOverviewFallback {
  headline: string;
  summary: string;
  postureCards: PostureCard[];
  suggestions: Suggestion[];
  sources: string[];
}
