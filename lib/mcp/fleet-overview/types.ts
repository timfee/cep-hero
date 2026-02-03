import { type VectorSearchResult } from "@/lib/upstash/search";

export interface FleetKnowledgeContext {
  docs: VectorSearchResult | null;
  policies: VectorSearchResult | null;
}

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

export interface Suggestion {
  text: string;
  action: string;
  priority: number;
  category: "security" | "compliance" | "monitoring" | "optimization";
}

export interface FleetOverviewFallback {
  headline: string;
  summary: string;
  postureCards: PostureCard[];
  suggestions: Suggestion[];
  sources: string[];
}
