import { google as googleModel } from "@ai-sdk/google";
import { generateText, Output } from "ai";

import { FleetOverviewResponseSchema } from "@/lib/mcp/schemas";

import {
  type FleetKnowledgeContext,
  type FleetOverviewFacts,
  type FleetOverviewFallback,
  type Suggestion,
} from "./types";

const FLEET_OVERVIEW_SYSTEM_PROMPT = `You are the Chrome Enterprise Premium assistant (CEP assistant) - a knowledgeable Chrome Enterprise Premium expert who helps IT admins secure and manage their browser fleet. You're direct, helpful, and focused on actionable insights. Write like a human in a chat: smooth, conversational, and concise. Never be generic, robotic, or listy.`;

function buildFleetOverviewPrompt(
  facts: FleetOverviewFacts,
  context: Record<string, unknown>,
  knowledge: FleetKnowledgeContext
): string {
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
- \`text\`: Clear, action-oriented text explaining what to do and why
- \`action\`: The exact command to execute
- \`priority\`: 1-10 (1=most urgent)
- \`category\`: "security", "compliance", "monitoring", or "optimization"
Do NOT include emails, domains, or URLs in suggestions.

**Suggestion Examples Based on Common Gaps:**
- If dlpRuleCount is 0: "Set up a DLP audit rule to monitor all traffic for sensitive data like SSNs and credit cards"
- If connectorPolicyCount is 0: "Configure connector policies to enable real-time data protection"
- If eventCount is low: "Enable Chrome event reporting to get visibility into browser activity"
- If events exist but no DLP: "Your fleet is generating events but has no DLP rules - add rules to protect sensitive data"

Do NOT suggest generic things like "Review connector settings" - be specific about what action to take and why.

### Sources
List the actual API sources used: "Admin SDK Reports", "Cloud Identity", "Chrome Policy"
`;
}

/**
 * Use the AI model to synthesize a narrative summary from structured facts.
 */
export async function summarizeFleetOverview(
  facts: FleetOverviewFacts,
  context: Record<string, unknown>,
  knowledge: FleetKnowledgeContext
): Promise<ReturnType<typeof FleetOverviewResponseSchema.parse>> {
  const result = await generateText({
    model: googleModel("gemini-2.0-flash-001"),
    output: Output.object({ schema: FleetOverviewResponseSchema }),
    system: FLEET_OVERVIEW_SYSTEM_PROMPT,
    prompt: buildFleetOverviewPrompt(facts, context, knowledge),
  });

  return result.output;
}

/**
 * Build a fallback overview when AI summarization fails.
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

function buildFallbackSuggestions(
  hasDlpRules: boolean,
  hasConnectors: boolean,
  hasEvents: boolean
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  if (!hasDlpRules) {
    suggestions.push({
      text: "Set up a DLP audit rule to monitor all traffic for sensitive data like SSNs and credit cards",
      action: "Help me set up DLP to audit all traffic for sensitive data",
      priority: 1,
      category: "security",
    });
  }

  if (!hasConnectors) {
    suggestions.push({
      text: "Configure connector policies to enable real-time data protection across your fleet",
      action: "Help me configure connector policies for data protection",
      priority: 2,
      category: "security",
    });
  }

  if (!hasEvents) {
    suggestions.push({
      text: "Enable Chrome event reporting to get visibility into browser activity",
      action: "How do I enable Chrome event reporting?",
      priority: 3,
      category: "monitoring",
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      text: "Review your security posture and identify optimization opportunities",
      action: "Analyze my fleet security posture",
      priority: 5,
      category: "optimization",
    });
  }

  return suggestions;
}

function buildFallbackHeadline(
  hasDlpRules: boolean,
  hasConnectors: boolean
): string {
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
