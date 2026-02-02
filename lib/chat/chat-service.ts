import { google } from "@ai-sdk/google";
import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";

import { diagnose } from "@/app/api/chat/diagnose";
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

const systemPrompt =
  "You are CEP Hero, a troubleshooting expert for Chrome Enterprise Premium. Your goal is to identify the root cause of issues, not just answer questions. " +
  "Analyze returned data critically. If you see generic names or IDs (e.g. 'rule-1', 'policy-A'), warn the user that this makes debugging difficult and suggest inspecting specific items. " +
  "When a tool returns a list (like org units, rules, events), you MUST parse the list and present a summary or a markdown table of the key items, along with analysis of any potential issues or patterns. Do not rely on the user to read the raw tool output. " +
  "If connector policies are missing or empty, suggest checking org unit targeting and admin scopes. " +
  "Use the 'lookupKnowledge' tool to search for documentation and policies when you need to verify error codes, configuration requirements, or concept definitions. " +
  "You MUST use the 'suggestActions' tool to present follow-up options or next steps. Do NOT list next steps as text in your message body. The UI requires this tool to display clickable buttons. " +
  "Example: Instead of writing 'You can try to fetch events or check rules', call `suggestActions({ actions: ['Get recent Chrome events', 'List DLP rules'] })`. " +
  "Do not bypass the model or return synthetic responses outside EVAL_TEST_MODE.";

interface CreateChatStreamParams {
  messages: ChatMessage[];
  accessToken: string;
  req: Request; // Passed for 'diagnose' tool which needs req context
}

/**
 * Creates and configures the AI chat stream with all CEP tools registered.
 *
 * @param params - Configuration parameters for the chat stream.
 * @param params.messages - The conversation history.
 * @param params.accessToken - Google OAuth access token for tool execution.
 * @param params.req - The original request object (needed for some tools).
 * @returns A streaming response compatible with the AI SDK.
 */
export async function createChatStream({
  messages,
  accessToken,
  req,
}: CreateChatStreamParams) {
  const executor = new CepToolExecutor(accessToken);

  // Track structured data from diagnosis tool for message metadata
  let diagnosisResult: Awaited<ReturnType<typeof diagnose>> | null = null;

  const result = streamText({
    model: google("gemini-2.0-flash-001"),
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    stopWhen: stepCountIs(5),
    tools: {
      lookupKnowledge: tool({
        description:
          "Search the knowledge base for documentation and policy definitions.",
        inputSchema: z.object({
          query: z.string().describe("The search query string"),
        }),
        execute: async ({ query }) => {
          const [docs, policies] = await Promise.all([
            searchDocs(query),
            searchPolicies(query),
          ]);
          return { docs, policies };
        },
      }),

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

      runDiagnosis: tool({
        description: "Run full diagnosis and return structured answer.",
        inputSchema: z.object({ prompt: z.string() }),
        execute: async (args) => {
          // Note: 'diagnose' internally likely uses req.headers or similar.
          // Since we passed 'req', we are good.
          const result = await diagnose(req, args.prompt);
          diagnosisResult = result;
          return result;
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    messageMetadata: () => {
      // Build structured evidence for the UI from diagnosis
      const evidence =
        diagnosisResult && !("error" in diagnosisResult)
          ? {
              planSteps: diagnosisResult.planSteps,
              hypotheses: diagnosisResult.hypotheses,
              nextSteps: diagnosisResult.nextSteps,
              missingQuestions: diagnosisResult.missingQuestions,
              evidence: diagnosisResult.evidence,
              connectorAnalysis: diagnosisResult.evidence?.connectorAnalysis,
            }
          : undefined;

      // Build action buttons from next steps (diagnosis) OR generic actions (if we track them)
      // For now, rely on diagnosisResult or client-side handling of 'suggestActions' tool result
      const actions =
        diagnosisResult && !("error" in diagnosisResult)
          ? diagnosisResult.nextSteps?.map((step, i) => ({
              id: `next-step-${i}`,
              label: step,
              command: step,
            }))
          : [];

      if (!evidence && (!actions || actions.length === 0)) {
        return undefined;
      }

      return { evidence, actions };
    },
  });
}
