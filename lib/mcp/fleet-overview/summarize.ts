/**
 * AI-powered summarization and fallback builders for fleet overview.
 */

import { google as googleModel } from "@ai-sdk/google";
import { generateText, Output } from "ai";

import {
  type FleetOverviewResponse,
  FleetOverviewResponseSchema,
} from "@/lib/mcp/schemas";

import {
  type FleetKnowledgeContext,
  type FleetOverviewFacts,
  type FleetOverviewFallback,
  type PostureCard,
  type Suggestion,
} from "./types";

const FLEET_OVERVIEW_SYSTEM_PROMPT = `You are the Chrome Enterprise Premium assistant (CEP assistant) - a knowledgeable Chrome Enterprise Premium expert who helps IT admins secure and manage their browser fleet. You're direct, helpful, and focused on actionable insights. Write like a human in a chat: smooth, conversational, and concise. Never be generic, robotic, or listy.`;

/**
 * Builds the prompt for fleet overview AI summarization.
 */
function buildFleetOverviewPrompt(
  facts: FleetOverviewFacts,
  context: Record<string, unknown>,
  knowledge: FleetKnowledgeContext
) {
  return `Analyze this Chrome Enterprise fleet data and generate a compelling overview.

## Fleet Facts
${JSON.stringify(facts, null, 2)}

## Raw API Data
${JSON.stringify(context, null, 2)}

## Knowledge Context
${JSON.stringify(knowledge, null, 2)}

## Output Requirements

### Headline
Write a single welcoming sentence as a light check-in. Keep it under 15 words. Do NOT include emails, domains, or URLs. Keep it calm, high-level, and non-alarmist. Avoid diagnostic or problem-focused language in the headline. Examples:
- "Welcome back. Here's a quick fleet check-in."
- "You're set to review a few key fleet highlights."
Avoid overly generic headlines; focus on what's most actionable or notable.

### Summary
Write 2-3 sentences as a single paragraph. Make it conversational and actionable, not choppy. Avoid colons, parentheses, and bullet-like phrasing. Use natural language that explains what matters and what the admin can do next (e.g., "I can help you set up connector policies" or "We can review recent DLP activity"). Keep it calm and helpful, avoid dense statistics, and do NOT include emails, domains, or URLs.
If \`eventSampled\` is true, do NOT claim a full total; describe it as a sample.

### Posture Cards (generate 3-5 cards, prioritized by importance)
Each card should represent a meaningful security or compliance metric:

1. **DLP Coverage** - Are DLP rules configured? How many? Status: healthy if >0 rules, warning if 0.
2. **Event Monitoring** - Are Chrome events being captured? Status based on event count and recency. Use \`eventWindowLabel\`, \`eventCount\`, \`blockedEventCount\`, and \`eventSampled\` to make the value meaningful.
3. **Connector Policies** - Are data connectors configured? Status: critical if 0, healthy if configured.
4. **Browser Security** - Cookie encryption, incognito mode, Safe Browsing status (infer from connector policies if available).

For each card:
- \`label\`: Clear, human name (e.g., "Data Protection Rules", "Security Events", "Connector Status")
- \`value\`: The metric (e.g., "50 rules", "Last 6h: 42 events (5 blocked)", "Last 15 days: 120+ events (sampled)", "Not configured")
- \`note\`: Contextual, human-readable insight (NOT dates like "2026-01-20", but things like "Protecting sensitive data" or "No rules configured yet")
- \`status\`: "healthy" (green), "warning" (yellow), "critical" (red), or "info" (blue)
- \`progress\`: Optional 0-100 percentage if applicable
- \`priority\`: 1-10 (1=most important, show critical issues first)
- \`action\`: Command to run when clicked (e.g., "List data protection rules", "Show recent security events")
- \`lastUpdated\`: ISO timestamp if available

### Suggestions (generate 2-4 actionable suggestions based on gaps)
Prioritize by impact. Each suggestion must have:
- \`text\`: Short button label (3-5 words, imperative verb). Examples: "Create a DLP rule", "Enable event reporting"
- \`action\`: The command to execute (one sentence max)
- \`priority\`: 1-10 (1=most urgent)
- \`category\`: "security", "compliance", "monitoring", or "optimization"
Do NOT include emails, domains, or URLs in suggestions.

**Suggestion text/action examples (text MUST be 3-5 words):**
- If dlpRuleCount is 0: text="Create a DLP rule", action="Create a DLP rule to audit all traffic"
- If connectorPolicyCount is 0: text="Configure connectors", action="Set up connector policies for data protection"
- If eventCount is low: text="Enable event reporting", action="Enable Chrome event reporting for my fleet"
- If events exist but no DLP: text="Add DLP rules", action="Create DLP rules to protect sensitive data"

Do NOT suggest generic things like "Review connector settings" - be specific about what action to take and why.

### Sources
List the actual API sources used: "Admin SDK Reports", "Cloud Identity", "Chrome Policy"
`;
}

/**
 * Derives a deterministic status for a posture card based on its label and fleet facts.
 * Matches the card label against known categories using keywords so AI-generated
 * label variations (e.g. "DLP Coverage" vs "Data Protection Rules") resolve consistently.
 */
function resolveCardStatus(
  label: string,
  facts: FleetOverviewFacts
): PostureCard["status"] {
  const lower = label.toLowerCase();

  if (
    lower.includes("dlp") ||
    lower.includes("data protection") ||
    lower.includes("data loss")
  ) {
    return facts.dlpRuleCount > 0 ? "healthy" : "critical";
  }

  if (
    lower.includes("event") ||
    lower.includes("monitoring") ||
    lower.includes("activity")
  ) {
    if (facts.eventCount === 0) {
      return "warning";
    }
    return facts.blockedEventCount > 0 ? "warning" : "healthy";
  }

  if (lower.includes("connector")) {
    return facts.connectorPolicyCount > 0 ? "healthy" : "critical";
  }

  return undefined;
}

/**
 * Derives a deterministic category for a suggestion based on its text content.
 * Ensures the same type of suggestion always gets the same color treatment.
 */
function resolveSuggestionCategory(
  text: string
): Suggestion["category"] | undefined {
  const lower = text.toLowerCase();

  if (
    lower.includes("dlp") ||
    lower.includes("data protection") ||
    lower.includes("connector") ||
    lower.includes("block") ||
    lower.includes("encrypt")
  ) {
    return "security";
  }

  if (
    lower.includes("event") ||
    lower.includes("reporting") ||
    lower.includes("monitor") ||
    lower.includes("visibility")
  ) {
    return "monitoring";
  }

  if (lower.includes("audit") || lower.includes("compliance")) {
    return "compliance";
  }

  return undefined;
}

/**
 * Overrides AI-assigned posture card statuses and suggestion categories with
 * deterministic values derived from the fleet facts and content keywords.
 * This prevents color inconsistencies across reloads caused by non-deterministic
 * AI output.
 */
export function enforceCardStyles(
  overview: FleetOverviewResponse,
  facts: FleetOverviewFacts
): FleetOverviewResponse {
  return {
    ...overview,
    postureCards: overview.postureCards.map((card) => {
      const deterministic = resolveCardStatus(card.label, facts);
      return deterministic ? { ...card, status: deterministic } : card;
    }),
    suggestions: overview.suggestions.map((suggestion) => {
      const deterministic = resolveSuggestionCategory(suggestion.text);
      return deterministic
        ? { ...suggestion, category: deterministic }
        : suggestion;
    }),
  };
}

/**
 * Uses the AI model to synthesize a narrative summary from structured facts.
 * Enforces deterministic card statuses after AI generation.
 */
export async function summarizeFleetOverview(
  facts: FleetOverviewFacts,
  context: Record<string, unknown>,
  knowledge: FleetKnowledgeContext
) {
  const result = await generateText({
    model: googleModel("gemini-3-flash-preview"),
    output: Output.object({ schema: FleetOverviewResponseSchema }),
    system: FLEET_OVERVIEW_SYSTEM_PROMPT,
    prompt: buildFleetOverviewPrompt(facts, context, knowledge),
  });

  if (!result.output) {
    return result.output;
  }

  return enforceCardStyles(result.output, facts);
}

/**
 * Builds a fallback overview when AI summarization fails.
 */
export function buildFallbackOverview(
  facts: FleetOverviewFacts
): FleetOverviewFallback {
  const hasDlpRules = facts.dlpRuleCount > 0;
  const hasConnectors = facts.connectorPolicyCount > 0;
  const hasEvents = facts.eventCount > 0;
  const suggestions = buildFallbackSuggestions(
    hasDlpRules,
    hasConnectors,
    hasEvents
  );
  const headline = buildFallbackHeadline(hasDlpRules, hasConnectors);

  return {
    headline,
    summary:
      "Here's a quick check-in based on your fleet data. I can help you address the items below.",
    postureCards: buildFallbackCards(
      facts,
      hasDlpRules,
      hasConnectors,
      hasEvents
    ),
    suggestions,
    sources: ["Admin SDK Reports", "Cloud Identity", "Chrome Policy"],
  };
}

/**
 * Builds fallback suggestions based on detected gaps.
 */
function buildFallbackSuggestions(
  hasDlpRules: boolean,
  hasConnectors: boolean,
  hasEvents: boolean
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  if (!hasDlpRules) {
    suggestions.push({
      text: "Create a DLP rule",
      action: "Create a DLP rule to audit all traffic",
      priority: 1,
      category: "security",
    });
  }

  if (!hasConnectors) {
    suggestions.push({
      text: "Configure connectors",
      action: "Help me configure connector policies",
      priority: 2,
      category: "security",
    });
  }

  if (!hasEvents) {
    suggestions.push({
      text: "Enable event reporting",
      action: "Enable Chrome event reporting for my fleet",
      priority: 3,
      category: "monitoring",
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      text: "Review security posture",
      action: "Analyze my fleet security posture",
      priority: 5,
      category: "optimization",
    });
  }

  return suggestions;
}

/**
 * Builds a fallback headline based on detected gaps.
 */
function buildFallbackHeadline(hasDlpRules: boolean, hasConnectors: boolean) {
  const missingItems = [
    !hasDlpRules && "DLP rules",
    !hasConnectors && "connector policies",
  ].filter(Boolean);

  if (missingItems.length === 0) {
    return "Welcome back — here's a quick fleet check-in.";
  }
  if (missingItems.length === 2) {
    return "Welcome back — a couple security gaps are worth tightening up.";
  }
  return `Welcome back — ${missingItems[0]} still need attention.`;
}

/**
 * Builds fallback posture cards from fleet facts.
 */
function buildFallbackCards(
  facts: FleetOverviewFacts,
  hasDlpRules: boolean,
  hasConnectors: boolean,
  hasEvents: boolean
) {
  const eventSampleNote = facts.eventSampled ? " (sampled)" : "";
  const eventCountLabel = facts.eventSampled
    ? `${facts.eventCount}+ events${eventSampleNote}`
    : `${facts.eventCount} events`;

  return [
    buildDlpCard(facts, hasDlpRules),
    buildEventsCard(facts, hasEvents, eventCountLabel),
    buildConnectorCard(facts, hasConnectors),
  ];
}

/**
 * Builds the DLP rules posture card.
 */
function buildDlpCard(facts: FleetOverviewFacts, hasDlpRules: boolean) {
  return {
    label: "Data Protection Rules",
    value: hasDlpRules ? `${facts.dlpRuleCount} rules` : "Not configured",
    note: hasDlpRules
      ? "Protecting sensitive data"
      : "No rules to detect sensitive data",
    source: "Cloud Identity",
    action: "List data protection rules",
    lastUpdated: new Date().toISOString(),
    status: hasDlpRules ? ("healthy" as const) : ("critical" as const),
    priority: hasDlpRules ? 3 : 1,
  };
}

/**
 * Builds the security events posture card.
 */
function buildEventsCard(
  facts: FleetOverviewFacts,
  hasEvents: boolean,
  eventCountLabel: string
) {
  const blockedSuffix =
    facts.blockedEventCount > 0 ? ` (${facts.blockedEventCount} blocked)` : "";

  return {
    label: "Security Events",
    value: hasEvents
      ? `${eventCountLabel} in ${facts.eventWindowLabel}${blockedSuffix}`
      : "No events",
    note: hasEvents
      ? `Recent activity across the last ${facts.eventWindowLabel}`
      : "Event reporting may be disabled",
    source: "Admin SDK Reports",
    action: "Show recent security events",
    lastUpdated: facts.latestEventAt ?? new Date().toISOString(),
    status: hasEvents ? ("healthy" as const) : ("warning" as const),
    priority: hasEvents ? 4 : 2,
  };
}

/**
 * Builds the connector policies posture card.
 */
function buildConnectorCard(facts: FleetOverviewFacts, hasConnectors: boolean) {
  return {
    label: "Connector Policies",
    value: hasConnectors
      ? `${facts.connectorPolicyCount} policies`
      : "Not configured",
    note: hasConnectors
      ? "Data connectors active"
      : "No connector policies configured",
    source: "Chrome Policy",
    action: "Review connector configuration",
    lastUpdated: new Date().toISOString(),
    status: hasConnectors ? ("healthy" as const) : ("critical" as const),
    priority: hasConnectors ? 5 : 3,
  };
}
