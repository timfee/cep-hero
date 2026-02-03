import { google } from "@ai-sdk/google";
import { generateObject, streamText, tool, stepCountIs } from "ai";
import { z } from "zod";

import type { IToolExecutor } from "@/lib/mcp/types";

import {
  CepToolExecutor,
  DraftPolicyChangeSchema,
  EnrollBrowserSchema,
  GetChromeEventsSchema,
  GetConnectorConfigSchema,
  GetFleetOverviewSchema,
  ListDLPRulesSchema,
  ListOrgUnitsSchema,
} from "@/lib/mcp/registry";
import { searchDocs, searchPolicies } from "@/lib/upstash/search";

import { ChatMessage } from "./request-utils";

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

You CANNOT:
- Directly modify policies, rules, or configurations in the Admin Console
- Enable or disable features without user confirmation
- Execute changes on behalf of the administrator

# Policy Change Workflow (Draft & Commit Pattern)
When you identify an issue requiring configuration changes:
1. First, explain the issue and what needs to change
2. Use the draftPolicyChange tool to propose the change with:
   - policyName: Human-readable name (e.g., "Enable Cookie Encryption")
   - proposedValue: The JSON configuration to apply
   - targetUnit: The Org Unit ID to apply this to
   - reasoning: Why this change is recommended
3. The UI will render a confirmation card for the user to review
4. Wait for user to say "Confirm" or "Cancel" before proceeding
5. If confirmed, provide the Admin Console link and step-by-step instructions

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

# Standard Operating Procedure for investigations
1) If the user reports fleet-wide issues or policies not applying, start by calling:
   - getChromeEvents (recent events, maxResults if provided)
   - getChromeConnectorConfiguration (connector policies)
   - listDLPRules (policies list)
2) Analyze connector policy targeting. If any policies target customers, flag mis-scoping and recommend org unit/group targeting.
3) If events are empty or errors occur, call debugAuth to inspect scopes/expiry.
4) If tool outputs include errors, codes, or unfamiliar terms, call searchKnowledge to ground the error before proposing fixes.
5) Present findings concisely with remediation steps.
6) REQUIRED: Call suggestActions with relevant follow-up options.

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
  executor?: IToolExecutor;
}

/**
 * Creates and configures the AI chat stream with all CEP tools registered.
 *
 * @param params - Configuration parameters for the chat stream.
 * @param params.messages - The conversation history.
 * @param params.accessToken - Google OAuth access token for tool execution.
 * @returns A streaming response compatible with the AI SDK.
 */
export async function createChatStream({
  messages,
  accessToken,
  executor: providedExecutor,
}: CreateChatStreamParams) {
  const executor: IToolExecutor =
    providedExecutor ?? (new CepToolExecutor(accessToken) as IToolExecutor);

  // 1. Analyze intent and proactively retrieve knowledge (RAG)
  const lastUserMessage = messages
    .filter((m) => m.role === "user")
    .at(-1)?.content;

  let knowledgeContext = "";

  if (lastUserMessage) {
    try {
      // Fast pass to check if we need to search docs
      const intentAnalysis = await generateObject({
        model: google("gemini-2.0-flash-001"), // Use a fast model for routing
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
        prompt: `Analyze the user's latest message: "${lastUserMessage}". Do they need documentation or policy definitions?`,
      });

      if (intentAnalysis.object.needsKnowledge) {
        const query = intentAnalysis.object.query;
        const [docs, policies] = await Promise.all([
          searchDocs(query),
          searchPolicies(query),
        ]);

        const docSnippets =
          docs?.hits
            ?.map((d) => `[Doc: ${d.metadata?.title}]\n${d.content}`)
            .join("\n\n") || "";
        const policySnippets =
          policies?.hits
            ?.map((p) => `[Policy: ${p.metadata?.title}]\n${p.content}`)
            .join("\n\n") || "";

        if (docSnippets || policySnippets) {
          knowledgeContext = `\n\nRelevant Context retrieved from knowledge base:\n${docSnippets}\n${policySnippets}\n`;
        }
      }
    } catch (err) {
      console.error("Knowledge retrieval failed:", err);
      // Proceed without context on error
    }
  }

  // Inject knowledge into the system prompt or as a context message
  // We'll append it to the system prompt for visibility
  const enhancedSystemPrompt = knowledgeContext
    ? `${systemPrompt}${knowledgeContext}`
    : systemPrompt;

  const result = streamText({
    model: google("gemini-2.0-flash-001"),
    messages: [{ role: "system", content: enhancedSystemPrompt }, ...messages],
    stopWhen: stepCountIs(5),
    tools: {
      getChromeEvents: tool({
        description: "Get recent Chrome events.",
        inputSchema: GetChromeEventsSchema,
        execute: async (args) => await executor.getChromeEvents(args),
      }),

      getChromeConnectorConfiguration: tool({
        description: "Fetch Chrome connector configuration policies.",
        inputSchema: GetConnectorConfigSchema,
        execute: async () => await executor.getChromeConnectorConfiguration(),
      }),

      listDLPRules: tool({
        description: "List DLP rules from Cloud Identity.",
        inputSchema: ListDLPRulesSchema,
        execute: async (args) => await executor.listDLPRules(args),
      }),

      enrollBrowser: tool({
        description:
          "Generate a Chrome Browser Cloud Management enrollment token.",
        inputSchema: EnrollBrowserSchema,
        execute: async (args) => await executor.enrollBrowser(args),
      }),

      listOrgUnits: tool({
        description: "List all organizational units (OUs).",
        inputSchema: ListOrgUnitsSchema,
        execute: async () => await executor.listOrgUnits(),
      }),

      getFleetOverview: tool({
        description: "Summarize fleet posture from live CEP data.",
        inputSchema: GetFleetOverviewSchema,
        execute: async (args) => await executor.getFleetOverview(args),
      }),

      debugAuth: tool({
        description: "Inspect access token scopes and expiry.",
        inputSchema: debugAuthSchema,
        execute: async () => await executor.debugAuth(),
      }),

      suggestActions: tool({
        description:
          "Suggest follow-up actions to the user. Use this to provide clickable buttons for next steps.",
        inputSchema: z.object({
          actions: z.array(z.string()).describe("List of action commands"),
        }),
        execute: async ({ actions }) => {
          return { actions };
        },
      }),

      draftPolicyChange: tool({
        description:
          "Draft a policy change proposal for user review. Returns a confirmation card that the user can approve before any changes are made.",
        inputSchema: DraftPolicyChangeSchema,
        execute: async (args) => await executor.draftPolicyChange(args),
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
