/**
 * AI chat service that orchestrates CEP diagnostic tools with Gemini.
 */

import { google } from "@ai-sdk/google";
import { generateText, Output, stepCountIs, streamText, tool } from "ai";
import { z } from "zod";

import { HIDDEN_TOOL_NAMES } from "@/lib/mcp/constants";
import {
  ApplyPolicyChangeSchema,
  CepToolExecutor,
  CreateDLPRuleSchema,
  DraftPolicyChangeSchema,
  EnrollBrowserSchema,
  GetChromeEventsSchema,
  GetConnectorConfigSchema,
  GetFleetOverviewSchema,
  ListDLPRulesSchema,
  ListOrgUnitsSchema,
} from "@/lib/mcp/registry";
import { type ToolExecutor } from "@/lib/mcp/types";
import { searchDocs, searchPolicies } from "@/lib/upstash/search";

import { type ChatMessage } from "./request-utils";

export const maxDuration = 30;

const CHAT_MODEL = "gemini-3-flash-preview" as const;

const debugAuthSchema = z.object({});

const systemPrompt = `You are CEP Hero, a troubleshooting expert for Chrome Enterprise Premium.

# Tools
- **getChromeEvents**: Fetch audit logs and security events
- **getChromeConnectorConfiguration**: Check connector/reporting policies
- **listDLPRules**: List existing DLP rules
- **createDLPRule**: Create a new DLP audit or block rule
- **draftPolicyChange**: Propose a Chrome policy change (UI renders a confirmation card)
- **applyPolicyChange**: Apply a confirmed Chrome policy change
- **enrollBrowser**: Generate a CBCM enrollment token
- **listOrgUnits**: List organizational units
- **getFleetOverview**: Summarize fleet posture (internally fetches events, DLP rules, and connector config)
- **debugAuth**: Inspect token scopes/expiry
- **searchKnowledge**: Search documentation for error codes, concepts, and best practices
- **suggestActions**: Offer follow-up action buttons to the user

These are internal identifiers — never surface them to users.

# Avoiding Redundant Tool Calls
- Never call the same tool twice in one response.
- getFleetOverview already fetches events, DLP rules, and connector config internally. When using it, do NOT also call getChromeEvents, listDLPRules, or getChromeConnectorConfiguration — that would duplicate work and clutter the response.
- Each tool call produces a visible UI card. Every card must earn its place — don't call tools whose results you won't directly reference.

# Safety
Never apply changes without explicit user confirmation. Always draft first, then wait for the user to say "Confirm".

# Diagnose Before Acting
When the user asks to change, enable, disable, or troubleshoot something, call a diagnostic tool first (getChromeConnectorConfiguration, getChromeEvents, listDLPRules, listOrgUnits, or searchKnowledge) to check the current state before calling draftPolicyChange.

# Chrome Policy Workflow (Draft & Commit)
When a user asks to change or apply a Chrome policy:
1. Call getChromeConnectorConfiguration first to check the current state
2. Pick sensible defaults. For targetUnit, use the org unit from the conversation context (e.g., the targetResource from getChromeConnectorConfiguration results, or the org unit the user mentioned). Only default to "/" if no specific org unit has been discussed. Do NOT ask the user for fields, suggest related policies, or offer alternatives — just draft the specific change requested.
3. Call draftPolicyChange with policyName, proposedValue, targetUnit, and reasoning. When proposing multiple changes in one response, call draftPolicyChange once per policy — each call renders a separate confirmation card.
4. STOP after draftPolicyChange. The UI shows a confirmation card. Write a brief (1-2 sentence) intro, then wait for the user to confirm. Do not repeat the card's details in text — the card IS the summary.
5. Call applyPolicyChange with the EXACT values from applyParams in the draft response — do not modify, truncate, or reconstruct them

# DLP Rule Workflow
When creating DLP rules:
1. Call listDLPRules to check what already exists — do NOT call listOrgUnits (org units are resolved automatically)
2. Pick sensible defaults (audit all traffic, all triggers) and call draftPolicyChange immediately — don't ask the user to fill in fields. For targetUnit, use the org unit from context or "/" if none is specified.
3. STOP after draftPolicyChange. The UI shows a confirmation card with the rule details. Write a brief (1-2 sentence) intro, then wait for the user to confirm. Do NOT also call createDLPRule — that happens only after the user says "Confirm".
4. After the user confirms, call createDLPRule with the proposed configuration

# Handling Confirmations
When the user says "Confirm" (or "yes", "do it", "apply"):
- For Chrome policies: call applyPolicyChange with the EXACT applyParams from the draft
- For DLP rules: call createDLPRule with the proposed configuration
- Do not ask for more details — just call the tool

# Standard Procedure
When a user reports an issue, call diagnostic tools first — don't give generic advice.
1. Start with getChromeEvents to check for errors
2. If events are empty, call getChromeConnectorConfiguration (reporting may be disabled)
3. Call listDLPRules if the issue involves data protection
4. If tools fail, call debugAuth to inspect scopes
5. Call searchKnowledge for any question about CEP features, error codes, configuration, or best practices — don't give generic advice without checking docs first
6. After diagnostic or informational responses, call suggestActions with 2-4 context-specific follow-up options. Skip it when you've just proposed a change and are waiting for "Confirm".

Never ask the user clarifying questions — not in text, not as bullet-point options, not as "would you like to..." prompts. If the query is ambiguous, pick the most likely interpretation and run the relevant tools. You can always course-correct after showing results. The ONLY way to offer follow-up options is via the suggestActions tool, never as text in your response.

Never mention internal tool names (getChromeEvents, getChromeConnectorConfiguration, listDLPRules, etc.) in responses. Use natural descriptions: "checked your audit logs", "reviewed connector policies", "looked at your DLP rules".

# Response Style
- Tool results render as rich UI cards (tables, badges, confirmation forms). Your text should synthesize and contextualize, not repeat what the cards show.
- After calling draftPolicyChange, write a brief 1-2 sentence introduction. The confirmation card IS the detailed content — do not duplicate it in text.
- After diagnostic tools, weave findings into a natural summary. The user already sees the raw data in the cards — your text adds interpretation and recommended actions.
- Keep responses focused. If you called 3 tools, a 3-5 sentence summary is usually sufficient.

# Tone & Formatting
Use natural language. Bold key terms. Don't use rigid section headers like "Diagnosis:" or "Evidence:" — instead use transitions like "Here's what I found", "The issue is", "I'd recommend".

When citing evidence, quote exact values from tool results (error codes, field names, counts, policy scopes) but weave them into natural sentences rather than listing them under a header.

# Source Citations
Reference source content naturally in your response but do NOT include markdown links or URLs inline. Do NOT add a "Sources" section or heading — the UI automatically displays sources in a collapsible drawer from searchKnowledge results.

# Org Units
Use friendly paths ("/Engineering", "/Sales/West Coast") as the primary identifier, not raw IDs. Use "/" for root. Tool outputs display org units with structured name + ID pills in the UI.

# Admin Console Links
- DLP Rules: https://admin.google.com/ac/chrome/dlp
- Connector Policies: https://admin.google.com/ac/chrome/settings/security
- Chrome Browser Management: https://admin.google.com/ac/chrome/browsers
- Organizational Units: https://admin.google.com/ac/orgunits
- Chrome Policies: https://admin.google.com/ac/chrome/settings

Do not bypass the model or return synthetic responses outside EVAL_TEST_MODE.`;

interface CreateChatStreamParams {
  messages: ChatMessage[];
  accessToken: string;
  executor?: ToolExecutor;
}

interface SearchHit {
  metadata?: { title?: string; url?: string };
  content?: string;
}

/**
 * Format search hits into a readable string for context injection.
 */
function formatHits(hits: SearchHit[] | undefined, prefix: string) {
  if (!Array.isArray(hits)) {
    return "";
  }
  return hits
    .map((item) => {
      const title =
        typeof item?.metadata?.title === "string"
          ? item.metadata.title
          : "Untitled";
      const url =
        typeof item?.metadata?.url === "string" ? item.metadata.url : "";
      const content =
        typeof item?.content === "string"
          ? item.content
          : String(item.content ?? "");
      const urlLine = url ? `URL: ${url}\n` : "";
      return `[${prefix}: ${title}]\n${urlLine}${content}`;
    })
    .join("\n\n");
}

/**
 * Use a fast model to determine if the user query needs knowledge retrieval.
 */
async function analyzeIntent(userMessage: string) {
  const result = await generateText({
    model: google(CHAT_MODEL),
    output: Output.object({
      schema: z.object({
        needsKnowledge: z
          .boolean()
          .describe(
            "True if the user is asking about concepts, errors, policies, or configuration steps."
          ),
        query: z
          .string()
          .describe("The search query for documentation and policies"),
      }),
    }),
    prompt: `Analyze the user's latest message: "${userMessage}". Do they need documentation or policy definitions?`,
  });
  return result;
}

/**
 * Fetch and format knowledge snippets from vector search.
 */
async function fetchKnowledgeSnippets(query: string) {
  const [docs, policies] = await Promise.all([
    searchDocs(query),
    searchPolicies(query),
  ]);
  const docSnippets = formatHits(docs?.hits, "Doc");
  const policySnippets = formatHits(policies?.hits, "Policy");
  if (docSnippets.length === 0 && policySnippets.length === 0) {
    return "";
  }
  return `\n\n## Knowledge Context\nUse this information to inform your response. Do NOT include URLs or a Sources section — the UI displays sources automatically.\n\n${docSnippets}\n${policySnippets}\n`;
}

/**
 * Retrieve relevant knowledge context based on user message intent.
 */
async function retrieveKnowledge(userMessage: string) {
  if (typeof userMessage !== "string" || userMessage.length === 0) {
    return "";
  }
  try {
    const intentAnalysis = await analyzeIntent(userMessage);
    return intentAnalysis.output.needsKnowledge
      ? await fetchKnowledgeSnippets(intentAnalysis.output.query)
      : "";
  } catch (error) {
    console.error("Knowledge retrieval failed:", error);
    return "";
  }
}

export interface StepAnalysis {
  hasToolResults: boolean;
  hasText: boolean;
  hasShortResponse: boolean;
  hasUIContent: boolean;
  textLength: number;
  onlySilentTools: boolean;
}

export interface LastStep {
  toolResults: unknown[];
  text: string;
  toolCalls: { toolName: string }[];
}

/**
 * Check whether a tool result produced a UI element (confirmation card, success
 * message, or manual steps) that the user can interact with directly.
 * When UI content is present, the response guard should not force extra loops.
 */
function hasUIResult(toolResults: unknown[]): boolean {
  for (const result of toolResults) {
    if (typeof result === "object" && result !== null && "_type" in result) {
      const typed = result as { _type: string };
      if (
        typed._type === "ui.confirmation" ||
        typed._type === "ui.success" ||
        typed._type === "ui.manual_steps" ||
        typed._type === "ui.error"
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Analyze the last step to determine what guards should be applied.
 * Steps that only called hidden tools are treated as having no actionable
 * tool results, preventing the "explain your results" guard from firing.
 */
export function analyzeLastStep(lastStep: LastStep): StepAnalysis {
  const onlySilentTools =
    lastStep.toolCalls.length > 0 &&
    lastStep.toolCalls.every((tc) => HIDDEN_TOOL_NAMES.has(tc.toolName));

  const hasToolResults = lastStep.toolResults.length > 0 && !onlySilentTools;
  const hasText = lastStep.text.trim().length > 0;
  const hasUIContent = hasUIResult(lastStep.toolResults);

  const textLength = lastStep.text.trim().length;
  const hasShortResponse = hasToolResults && hasText && textLength < 50;

  return {
    hasToolResults,
    hasText,
    hasShortResponse,
    hasUIContent,
    textLength,
    onlySilentTools,
  };
}

/**
 * Build guard instructions for completing responses after tool results.
 */
export function buildResponseCompletionGuard(enhancedSystemPrompt: string) {
  return {
    system: `${enhancedSystemPrompt}

You received tool results but didn't explain them. Summarize what you found and cite specific values. Do NOT include URLs or a Sources section — the UI handles source display. Do NOT ask the user any questions — call suggestActions with actionable follow-ups instead.`,
  };
}

/**
 * Build guard instructions for expanding short/truncated responses.
 */
export function buildShortResponseGuard(enhancedSystemPrompt: string) {
  return {
    system: `${enhancedSystemPrompt}

Your response was brief. Expand with specific evidence from the tool results. Do NOT include URLs or a Sources section — the UI handles source display. Do NOT ask the user any questions — call suggestActions with actionable follow-ups instead.`,
  };
}

/**
 * Compute the step response configuration based on analysis.
 * When the last step produced interactive UI content (confirmation cards,
 * success messages), the guard is skipped to prevent extra tool-call loops
 * that generate redundant duplicate cards and verbose text.
 */
export function computeStepResponse(
  analysis: StepAnalysis,
  enhancedSystemPrompt: string
): Record<string, unknown> {
  if (analysis.hasUIContent) {
    return {};
  }
  if (analysis.onlySilentTools && analysis.hasText) {
    return {
      toolChoice: "none" as const,
      system: `${enhancedSystemPrompt}\n\nYour response is already complete. Do not repeat or add to it. Stop generating.`,
    };
  }
  if (analysis.hasToolResults && !analysis.hasText) {
    return buildResponseCompletionGuard(enhancedSystemPrompt);
  }
  if (analysis.hasShortResponse) {
    return buildShortResponseGuard(enhancedSystemPrompt);
  }
  return {};
}

/**
 * Creates and configures the AI chat stream with all CEP tools registered.
 */
export async function createChatStream({
  messages,
  accessToken,
  executor: providedExecutor,
}: CreateChatStreamParams) {
  const executor = providedExecutor ?? new CepToolExecutor(accessToken);
  const lastUserMessage =
    messages.findLast((message) => message.role === "user")?.content ?? "";
  const knowledgeContext = await retrieveKnowledge(lastUserMessage);
  const enhancedSystemPrompt = knowledgeContext
    ? `${systemPrompt}${knowledgeContext}`
    : systemPrompt;

  const isFirstTurn = !messages.some((m) => m.role === "assistant");

  const mutationTools = {
    applyPolicyChange: tool({
      description:
        "Apply a policy change after user confirmation. Use this when the user says 'Confirm' after a draftPolicyChange proposal.",
      inputSchema: ApplyPolicyChangeSchema,
      execute: async (args) => {
        const result = await executor.applyPolicyChange(args);
        return result;
      },
    }),

    createDLPRule: tool({
      description:
        "Create a DLP (Data Loss Prevention) rule to monitor or block sensitive data. Use this for setting up audit rules or data protection policies.",
      inputSchema: CreateDLPRuleSchema,
      execute: async (args) => {
        const result = await executor.createDLPRule(args);
        return result;
      },
    }),
  };

  const result = streamText({
    model: google(CHAT_MODEL),
    messages: [{ role: "system", content: enhancedSystemPrompt }, ...messages],
    stopWhen: [
      stepCountIs(15),
      ({ steps }) => {
        const last = steps.at(-1);
        if (!last) {
          return false;
        }
        const hasText = last.text.trim().length > 100;
        const onlySilent =
          last.toolCalls.length > 0 &&
          last.toolCalls.every(
            (tc) => tc && HIDDEN_TOOL_NAMES.has(tc.toolName)
          );
        return hasText && onlySilent;
      },
    ],
    prepareStep: ({ steps }) => {
      if (steps.length === 0 && isFirstTurn) {
        return {
          toolChoice: "required" as const,
          activeTools: [
            "getChromeEvents",
            "getChromeConnectorConfiguration",
            "listDLPRules",
            "getFleetOverview",
            "searchKnowledge",
          ],
        };
      }
      if (steps.length === 0) {
        return { toolChoice: "required" as const };
      }
      const lastStep = steps.at(-1);
      if (!lastStep) {
        return {};
      }
      const analysis = analyzeLastStep(lastStep as LastStep);
      return computeStepResponse(analysis, enhancedSystemPrompt);
    },
    tools: {
      getChromeEvents: tool({
        description: "Get recent Chrome events.",
        inputSchema: GetChromeEventsSchema,
        execute: async (args) => {
          const result = await executor.getChromeEvents(args);
          return result;
        },
      }),

      getChromeConnectorConfiguration: tool({
        description: "Fetch Chrome connector configuration policies.",
        inputSchema: GetConnectorConfigSchema,
        execute: async () => {
          const result = await executor.getChromeConnectorConfiguration();
          return result;
        },
      }),

      listDLPRules: tool({
        description: "List DLP rules from Cloud Identity.",
        inputSchema: ListDLPRulesSchema,
        execute: async (args) => {
          const result = await executor.listDLPRules(args);
          return result;
        },
      }),

      enrollBrowser: tool({
        description:
          "Generate a Chrome Browser Cloud Management enrollment token.",
        inputSchema: EnrollBrowserSchema,
        execute: async (args) => {
          const result = await executor.enrollBrowser(args);
          return result;
        },
      }),

      listOrgUnits: tool({
        description: "List all organizational units (OUs).",
        inputSchema: ListOrgUnitsSchema,
        execute: async () => {
          const result = await executor.listOrgUnits();
          return result;
        },
      }),

      getFleetOverview: tool({
        description: "Summarize fleet posture from live CEP data.",
        inputSchema: GetFleetOverviewSchema,
        execute: async (args) => {
          const result = await executor.getFleetOverview(args);
          return result;
        },
      }),

      debugAuth: tool({
        description: "Inspect access token scopes and expiry.",
        inputSchema: debugAuthSchema,
        execute: async () => {
          const result = await executor.debugAuth();
          return result;
        },
      }),

      suggestActions: tool({
        description:
          "Suggest 2-4 follow-up actions directly related to what you just discussed. Only suggest actions that logically follow from the current topic — never generic unrelated actions.",
        inputSchema: z.object({
          actions: z
            .array(z.string())
            .describe(
              "Short imperative commands related to the current topic. After reviewing safe browsing, suggest 'Enable Safe Browsing for all users' — NOT 'Create a DLP rule'."
            ),
        }),
        execute: ({ actions }) => ({ actions }),
      }),

      draftPolicyChange: tool({
        description:
          "Draft a policy change proposal for user review. Returns a confirmation card that the user can approve before any changes are made.",
        inputSchema: DraftPolicyChangeSchema,
        execute: async (args) => {
          const result = await executor.draftPolicyChange(args);
          return result;
        },
      }),

      searchKnowledge: tool({
        description:
          "Search the knowledge base for documentation about Chrome Enterprise concepts, error codes, troubleshooting steps, and best practices. Results include title, url, and content. The UI automatically displays sources in a drawer — do NOT cite URLs inline or add a Sources section.",
        inputSchema: z.object({
          query: z
            .string()
            .describe(
              "Search query - include specific terms like error codes, feature names, or concepts"
            ),
        }),
        execute: async ({ query }) => {
          const [docs, policies] = await Promise.all([
            searchDocs(query),
            searchPolicies(query),
          ]);
          return {
            docs: docs.hits.map((h) => ({
              title: h.metadata?.title,
              url: h.metadata?.url,
              content: h.content,
            })),
            policies: policies.hits.map((h) => ({
              title: h.metadata?.title,
              url: h.metadata?.url,
              content: h.content,
            })),
          };
        },
      }),

      ...(isFirstTurn ? {} : mutationTools),
    },
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
  });
}
