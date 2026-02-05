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

const systemPrompt = `You are CEP Hero, a troubleshooting expert for Chrome Enterprise Premium. Your goal is to identify root causes and guide administrators through solutions.

# Your Capabilities
You CAN:
- Fetch and analyze Chrome events, DLP rules, and connector configurations
- Diagnose policy scoping issues and configuration problems
- Explain what needs to be changed and why
- Provide step-by-step guidance with Admin Console links
- Generate enrollment tokens for Chrome Browser Cloud Management
- Draft policy change proposals using the draftPolicyChange tool
- Apply policy changes after user confirmation using applyPolicyChange
- Create DLP audit rules using createDLPRule

You CANNOT:
- Execute changes without explicit user confirmation
- Modify policies until user says "Confirm"

# Policy Change Workflow (Draft & Commit Pattern)
When you identify an issue requiring configuration changes:
1. First, explain the issue and what needs to change
2. Use the draftPolicyChange tool to propose the change with:
   - policyName: Human-readable name (e.g., "Enable Cookie Encryption")
   - proposedValue: The JSON configuration to apply
   - targetUnit: The FULL Org Unit ID (e.g., "orgunits/03ph8a2z23yjui6") - NEVER truncate this
   - reasoning: Why this change is recommended
3. The UI will render a confirmation card for the user to review
4. Wait for user to say "Confirm" or "Cancel" before proceeding
5. If confirmed, call applyPolicyChange using the EXACT values from applyParams in the draft response
6. Report success or failure to the user

# CRITICAL: Handling User Confirmations
When the user says "Confirm" (or similar approval like "yes", "do it", "apply"):
- Look at the applyParams from your previous draftPolicyChange response
- Call applyPolicyChange with EXACTLY those values:
  - policySchemaId: Use the EXACT policySchemaId from applyParams
  - targetResource: Use the EXACT targetResource from applyParams (e.g., "orgunits/03ph8a2z23yjui6")
  - value: Use the EXACT value object from applyParams
- Do NOT modify, truncate, or reconstruct these values
- Do NOT ask for more details. Do NOT explain what you're about to do. Just call the tool.

# Browser Security Configuration
When the user asks about cookie encryption, incognito mode, or browser security:
1. IN THE SAME TURN: Call getChromeConnectorConfiguration AND draftPolicyChange (propose the changes)
2. Wait for user to say "Confirm"
3. Call applyPolicyChange with the proposed configuration

IMPORTANT: Steps 1 must happen together in ONE response - check settings AND propose changes immediately.

# Creating DLP Rules
When the user asks to set up DLP monitoring or audit rules:
1. IN THE SAME TURN: Call listDLPRules AND draftPolicyChange together. Draft the rule proposal immediately.
   - policyName: "DLP Audit Rule" (or similar descriptive name)
   - targetUnit: "/" (root) or specified org unit
   - proposedValue: { displayName: "Audit All Traffic", triggers: ["UPLOAD", "DOWNLOAD"], action: "AUDIT" }
   - reasoning: Why this rule is being created
2. Wait for user to say "Confirm"
3. When user says "Confirm", call createDLPRule with the proposed configuration

IMPORTANT: Steps 1 must happen together in ONE response - list existing rules AND propose new rule immediately. Do NOT wait for another user message between these steps.

# Org Unit Display (CRITICAL)
When mentioning org units in your responses:
1. Use the friendly path (e.g., "/Engineering", "/Sales/West Coast") as the primary identifier
2. If you need to reference a specific ID for clarity, format it as: path \`id\` (e.g., "/Engineering \`03ph8a2z\`")
3. Use "/" for the root org unit
4. NEVER show raw IDs like "orgunits/03ph8a2z..." alone without the friendly path
5. Prefer targetResourceName from tools when available
6. Tool outputs automatically display org units with structured name + ID pills in the UI

# Operating Principles
- Think in steps; decide what to inspect next based on results.
- Use tools in parallel when possible; avoid redundant calls.
- Always summarize tool outputs in plain language instead of dumping raw JSON.
- Break down complex fixes into numbered steps the admin can follow.
- Keep responses in plain text; tool outputs are rendered separately in the UI.

# Response Structure
When troubleshooting, structure your response with clear sections:
- **Diagnosis**: What is the root cause or likely issue
- **Evidence**: What data/logs/events support this conclusion. IMPORTANT: Cite exact error codes (e.g., ERR_NAME_NOT_RESOLVED, ERR_CONNECTION_TIMED_OUT), log entries, and technical identifiers from the data. Don't paraphrase - quote the actual values.
- **Hypotheses**: Alternative explanations if the diagnosis is uncertain
- **Next Steps**: Specific actions the admin should take. Include standard remediation steps like sysprep for VM cloning issues, license verification for enrollment issues, etc.

# CRITICAL: Always Suggest Next Steps
You MUST call suggestActions at the end of EVERY response with 2-4 relevant options.
Example actions based on context:
- After showing events: "Filter by error events", "Show DLP violations only", "Check connector config"
- After diagnosis: "Confirm this change", "Cancel", "Show me the Admin Console steps"
- After policy draft: "Confirm", "Cancel", "Modify the proposal"
- General: "Run another diagnostic", "Check authentication", "List organizational units"

# CRITICAL: Standard Operating Procedure for ALL troubleshooting
IMPORTANT: When a user reports ANY issue (enrollment, policy, connectivity, errors, etc.), you MUST call diagnostic tools FIRST before responding. Do NOT give generic advice without checking the data.

1) ALWAYS START by calling getChromeEvents to check for errors - this is your primary diagnostic tool.
2) If events are EMPTY or missing, ALWAYS call getChromeConnectorConfiguration to check if reporting is disabled (CloudReporting policy). Empty events usually mean reporting is turned off.
3) Call listDLPRules if the issue might involve data loss prevention.
4) If tool calls fail with errors, call debugAuth to inspect scopes/expiry.
5) If tool outputs include errors, codes, or unfamiliar terms, call searchKnowledge to ground the error before proposing fixes.
6) Analyze findings and present diagnosis with specific evidence from the data.
7) REQUIRED: Call suggestActions with relevant follow-up options.

NEVER respond with generic troubleshooting steps like "check your credentials" or "verify connectivity" without first calling getChromeEvents to see what's actually happening.

# Admin Console Deep Links (use these in your explanations)
- DLP Rules: https://admin.google.com/ac/chrome/dlp
- Connector Policies: https://admin.google.com/ac/chrome/settings/security
- Chrome Browser Management: https://admin.google.com/ac/chrome/browsers
- Organizational Units: https://admin.google.com/ac/orgunits
- Chrome Policies: https://admin.google.com/ac/chrome/settings

# Using searchKnowledge for Accurate Answers

IMPORTANT: When you encounter:
- Unfamiliar error codes (ERR_NAME_NOT_RESOLVED, etc.)
- Troubleshooting scenarios you're unsure about (VM cloning, enrollment issues)
- Questions about best practices or remediation steps
- Technical terms or field names (targetResource, sysprep, etc.)

Call searchKnowledge with a specific query to retrieve accurate documentation. Don't guess - search first.

Examples of when to search:
- "duplicate device ID VM cloning fix" → Learn about sysprep
- "enrollment token targetResource" → Learn about OU targeting
- "Chrome Enterprise Premium license requirements" → Learn about licensing
- "ERR_CONNECTION_TIMED_OUT network troubleshooting" → Learn about network diagnostics

# Evidence Requirements

When citing evidence in your diagnosis:
- Quote exact error codes from logs (ERR_NAME_NOT_RESOLVED, not "DNS failed")
- Reference specific field names from API responses (targetResource, not "target setting")
- Include technical identifiers that support your conclusion

Do not bypass the model or return synthetic responses outside EVAL_TEST_MODE.`;

interface CreateChatStreamParams {
  messages: ChatMessage[];
  accessToken: string;
  executor?: ToolExecutor;
}

interface SearchHit {
  metadata?: { title?: string };
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
      const content =
        typeof item?.content === "string"
          ? item.content
          : String(item.content ?? "");
      return `[${prefix}: ${title}]\n${content}`;
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
  return `\n\nRelevant Context retrieved from knowledge base:\n${docSnippets}\n${policySnippets}\n`;
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

interface StepAnalysis {
  hasToolResults: boolean;
  hasText: boolean;
  hasSuggestActionsCall: boolean;
  hasDlpProposalCall: boolean;
  recommendsDlpProposal: boolean;
}

interface LastStep {
  toolResults: unknown[];
  text: string;
  toolCalls: { toolName: string }[];
}

/**
 * Analyze the last step to determine what guards should be applied.
 */
function analyzeLastStep(lastStep: LastStep): StepAnalysis {
  const hasToolResults = lastStep.toolResults.length > 0;
  const hasText = lastStep.text.trim().length > 0;
  const hasSuggestActionsCall = lastStep.toolCalls.some(
    (call) => call.toolName === "suggestActions"
  );
  const hasDlpProposalCall = lastStep.toolCalls.some(
    (call) => call.toolName === "draftPolicyChange"
  );
  const recommendsDlpProposal =
    /dlp/i.test(lastStep.text) &&
    /(create|set up|propose|audit|monitor)/i.test(lastStep.text) &&
    /(rule|policy)/i.test(lastStep.text);

  return {
    hasToolResults,
    hasText,
    hasSuggestActionsCall,
    hasDlpProposalCall,
    recommendsDlpProposal,
  };
}

/**
 * Build guard instructions for DLP rule proposals.
 */
function buildDlpGuardResponse(enhancedSystemPrompt: string) {
  return {
    system: `${enhancedSystemPrompt}

# DLP Proposal Guard
You recommended creating a DLP rule. Now:
1) Call listDLPRules to show current rules.
2) Call draftPolicyChange to propose the DLP rule in the SAME step.
Use a clear display name. If a specific destination like sharefile.com was mentioned, target uploads and include that in the reasoning.
End by calling suggestActions.`,
    activeTools: ["listDLPRules", "draftPolicyChange", "suggestActions"],
  };
}

/**
 * Build guard instructions for completing responses after tool results.
 */
function buildResponseCompletionGuard(enhancedSystemPrompt: string) {
  return {
    system: `${enhancedSystemPrompt}

# Response Completion Guard
You just received tool results. Provide a concise response with:
- Diagnosis
- Evidence (cite exact fields)
- Hypotheses (only if uncertain)
- Next Steps (actionable)
If knowledge results were retrieved, summarize them clearly.
Use friendly org unit paths only; never show raw org unit IDs.
End by calling suggestActions with 2-4 options.`,
    activeTools: ["suggestActions"],
  };
}

/**
 * Build guard instructions for adding suggested actions.
 */
function buildActionCompletionGuard(enhancedSystemPrompt: string) {
  return {
    system: `${enhancedSystemPrompt}

# Action Completion Guard
You already provided context. Now call suggestActions with 2-4 relevant options.
If you add any text, keep it to one short sentence.`,
    activeTools: ["suggestActions"],
  };
}

/**
 * Compute the step response configuration based on analysis.
 */
function computeStepResponse(
  analysis: StepAnalysis,
  enhancedSystemPrompt: string
): Record<string, unknown> {
  if (analysis.recommendsDlpProposal && !analysis.hasDlpProposalCall) {
    return buildDlpGuardResponse(enhancedSystemPrompt);
  }
  if (analysis.hasToolResults && !analysis.hasText) {
    return buildResponseCompletionGuard(enhancedSystemPrompt);
  }
  if (analysis.hasToolResults && !analysis.hasSuggestActionsCall) {
    return buildActionCompletionGuard(enhancedSystemPrompt);
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

  const result = streamText({
    model: google("gemini-2.0-flash-001"),
    messages: [{ role: "system", content: enhancedSystemPrompt }, ...messages],
    stopWhen: [
      stepCountIs(15),
      ({ steps }) => {
        const lastStep = steps.at(-1);
        if (!lastStep) {
          return false;
        }
        const hasSuggestActions = lastStep.toolCalls.some(
          (call) => call.toolName === "suggestActions"
        );
        const hasText = lastStep.text.trim().length > 0;
        return hasSuggestActions && hasText;
      },
    ],
    prepareStep: ({ steps }) => {
      const lastStep = steps.at(-1);
      if (!lastStep) {
        return {};
      }
      const analysis = analyzeLastStep(lastStep);
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

      searchKnowledge: tool({
        description:
          "Search the knowledge base for documentation about Chrome Enterprise concepts, error codes, troubleshooting steps, and best practices. Use this when you encounter unfamiliar terms, error codes, or need to verify remediation steps.",
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
              content: h.content,
            })),
            policies: policies.hits.map((h) => ({
              title: h.metadata?.title,
              content: h.content,
            })),
          };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
  });
}
