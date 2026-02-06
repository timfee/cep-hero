/**
 * AI chat service that orchestrates CEP diagnostic tools with Gemini.
 */

import { google } from "@ai-sdk/google";
import { generateText, Output, stepCountIs, streamText, tool } from "ai";
import { z } from "zod";

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
- **getFleetOverview**: Summarize fleet posture
- **debugAuth**: Inspect token scopes/expiry
- **searchKnowledge**: Search documentation for error codes, concepts, and best practices
- **suggestActions**: Offer follow-up action buttons to the user

# Safety
Never apply changes without explicit user confirmation. Always draft first, then wait for the user to say "Confirm".

# Diagnose Before Acting
When the user asks to change, enable, disable, or troubleshoot something, call a diagnostic tool first (getChromeConnectorConfiguration, getChromeEvents, listDLPRules, listOrgUnits, or searchKnowledge) to check the current state before calling draftPolicyChange.

# Chrome Policy Workflow (Draft & Commit)
When a user asks to change or apply a Chrome policy:
1. Call getChromeConnectorConfiguration first to check the current state
2. Pick sensible defaults — use root "/" as targetUnit unless the user specifies otherwise. Do NOT ask the user for fields, suggest related policies, or offer alternatives — just draft the specific change requested.
3. Call draftPolicyChange with policyName, proposedValue, targetUnit (full org unit ID — never truncate), and reasoning
4. Wait for the user to confirm
5. Call applyPolicyChange with the EXACT values from applyParams in the draft response — do not modify, truncate, or reconstruct them

# DLP Rule Workflow
When creating DLP rules:
1. Call listDLPRules and listOrgUnits in parallel to see what exists
2. Pick sensible defaults (audit all traffic at root "/", all triggers) and call draftPolicyChange immediately — don't ask the user to fill in fields
3. Wait for user to say "Confirm"
4. Call createDLPRule with the proposed configuration

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

# Tone & Formatting
Use natural language. Bold key terms. Don't use rigid section headers like "Diagnosis:" or "Evidence:" — instead use transitions like "Here's what I found", "The issue is", "I'd recommend".

When citing evidence, quote exact values from tool results (error codes, field names, counts, policy scopes) but weave them into natural sentences rather than listing them under a header.

# Source Citations
Always cite sources from knowledge context. Use markdown links inline (e.g., [title](url)) and list all sources at the end under a **Sources** heading. This applies whether knowledge came from searchKnowledge or was provided as context.

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
    model: google("gemini-2.0-flash-001"),
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
  return `\n\n## Sources — cite these as [title](url)\nYou MUST cite the URLs below inline and list them under a **Sources** heading.\n\n${docSnippets}\n${policySnippets}\n`;
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
  textLength: number;
}

export interface LastStep {
  toolResults: unknown[];
  text: string;
  toolCalls: { toolName: string }[];
}

/**
 * Analyze the last step to determine what guards should be applied.
 */
export function analyzeLastStep(lastStep: LastStep): StepAnalysis {
  const hasToolResults = lastStep.toolResults.length > 0;
  const hasText = lastStep.text.trim().length > 0;

  const textLength = lastStep.text.trim().length;
  const hasShortResponse = hasToolResults && hasText && textLength < 50;

  return {
    hasToolResults,
    hasText,
    hasShortResponse,
    textLength,
  };
}

/**
 * Build guard instructions for completing responses after tool results.
 */
export function buildResponseCompletionGuard(enhancedSystemPrompt: string) {
  return {
    system: `${enhancedSystemPrompt}

You received tool results but didn't explain them. Summarize what you found, cite specific values, and suggest next steps. Then call suggestActions.`,
  };
}

/**
 * Build guard instructions for expanding short/truncated responses.
 */
export function buildShortResponseGuard(enhancedSystemPrompt: string) {
  return {
    system: `${enhancedSystemPrompt}

Your response was brief. Expand with specific evidence from the tool results and actionable next steps. Then call suggestActions.`,
  };
}

/**
 * Compute the step response configuration based on analysis.
 */
export function computeStepResponse(
  analysis: StepAnalysis,
  enhancedSystemPrompt: string
): Record<string, unknown> {
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
    model: google("gemini-2.0-flash-001"),
    messages: [{ role: "system", content: enhancedSystemPrompt }, ...messages],
    stopWhen: [stepCountIs(15)],
    prepareStep: ({ steps }) => {
      if (steps.length === 0 && isFirstTurn) {
        return {
          toolChoice: "required" as const,
          activeTools: [
            "getChromeEvents",
            "getChromeConnectorConfiguration",
            "listDLPRules",
            "listOrgUnits",
            "getFleetOverview",
            "searchKnowledge",
            "enrollBrowser",
            "debugAuth",
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
          "Suggest follow-up actions to the user. Use this to provide clickable buttons for next steps.",
        inputSchema: z.object({
          actions: z.array(z.string()).describe("List of action commands"),
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
          "Search the knowledge base for documentation about Chrome Enterprise concepts, error codes, troubleshooting steps, and best practices. Results include title, url, and content. You MUST cite these sources as [title](url) inline and list them under a **Sources** heading at the end.",
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
