import { google } from "@ai-sdk/google";
import { generateObject, streamText, tool, stepCountIs } from "ai";
import { z } from "zod";

import {
  CepToolExecutor,
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

When you identify an issue requiring configuration changes:
1. Use the draftPolicyChange tool to propose the change with reasoning
2. The UI will render a confirmation card for the user to review
3. Explain WHAT needs to change, WHY, and provide the Admin Console link
4. Wait for user confirmation before proceeding

# Operating Principles
- Think in steps; decide what to inspect next based on results.
- Use tools in parallel when possible; avoid redundant calls.
- Always summarize tool outputs in plain language instead of dumping raw JSON.
- Break down complex fixes into numbered steps the admin can follow.
- Keep responses in plain text; tool outputs are rendered separately in the UI.
- ALWAYS end your response by calling suggestActions with 2-4 relevant next steps.

# Standard Operating Procedure for investigations
1) If the user reports fleet-wide issues or policies not applying, start by calling:
   - getChromeEvents (recent events, maxResults if provided)
   - getChromeConnectorConfiguration (connector policies)
   - listDLPRules (policies list)
2) Analyze connector policy targeting. If any policies target customers, flag mis-scoping and recommend org unit/group targeting.
3) If events are empty or errors occur, call debugAuth to inspect scopes/expiry.
4) If tool outputs include errors, codes, or unfamiliar terms, call searchPolicies or searchDocs to ground the error before proposing fixes.
5) Present findings concisely with remediation steps.
6) REQUIRED: Call suggestActions with relevant follow-up options like "I've made the change - verify it", "Show me how to fix this", "Run another diagnostic", etc.

# Admin Console Deep Links (use these in your explanations)
- DLP Rules: https://admin.google.com/ac/chrome/dlp
- Connector Policies: https://admin.google.com/ac/chrome/settings/security
- Chrome Browser Management: https://admin.google.com/ac/chrome/browsers
- Organizational Units: https://admin.google.com/ac/orgunits
- Chrome Policies: https://admin.google.com/ac/chrome/settings

Do not bypass the model or return synthetic responses outside EVAL_TEST_MODE.`;

interface CreateChatStreamParams {
  messages: ChatMessage[];
  accessToken: string;
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
}: CreateChatStreamParams) {
  const executor = new CepToolExecutor(accessToken);

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
    },
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
  });
}
