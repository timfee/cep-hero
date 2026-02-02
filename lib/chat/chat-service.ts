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
} from "@/lib/mcp/registry";

import { ChatMessage } from "./request-utils";

export const maxDuration = 30;

const debugAuthSchema = z.object({});

const systemPrompt =
  "You are the CEP troubleshooting assistant. Answer concisely, then offer actions. Use tools only when needed and summarize results instead of dumping raw output. If connector policies are missing or empty, suggest checking org unit targeting and admin scopes. Do not bypass the model or return synthetic responses outside EVAL_TEST_MODE.";

interface CreateChatStreamParams {
  messages: ChatMessage[];
  accessToken: string;
  req: Request; // Passed for 'diagnose' tool which needs req context
}

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
      if (!diagnosisResult || "error" in diagnosisResult) return undefined;

      // Build structured evidence for the UI
      const evidence = {
        planSteps: diagnosisResult.planSteps,
        hypotheses: diagnosisResult.hypotheses,
        nextSteps: diagnosisResult.nextSteps,
        missingQuestions: diagnosisResult.missingQuestions,
        evidence: diagnosisResult.evidence,
        connectorAnalysis: diagnosisResult.evidence?.connectorAnalysis,
      };

      // Build action buttons from next steps
      const actions =
        diagnosisResult.nextSteps?.map((step, i) => ({
          id: `next-step-${i}`,
          label: step,
          command: step,
        })) ?? [];

      return { evidence, actions };
    },
  });
}
