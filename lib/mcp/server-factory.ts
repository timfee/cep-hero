import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";

import {
  CepToolExecutor,
  GetChromeEventsSchema,
  ListDLPRulesSchema,
  EnrollBrowserSchema,
  GetConnectorConfigSchema,
  GetFleetOverviewSchema,
} from "@/lib/mcp/registry";
import { searchDocs, searchPolicies } from "@/lib/upstash/search";

/**
 * A global map to hold active SSE transports.
 * Key: Session ID
 * Value: SSEServerTransport instance
 *
 * Note: In a serverless environment (like Vercel functions), this map will not persist
 * across different invocations unless the execution context is reused.
 * For 'bun dev' or long-running containers, this works as intended.
 */
export const transportMap = new Map<string, SSEServerTransport>();

/**
 * Factory function to create and configure an MCP Server instance.
 *
 * This function:
 * 1. Instantiates a new McpServer with the application's metadata.
 * 2. Initializes the business logic executor with the user's access token.
 * 3. Registers all available tools (getChromeEvents, listDLPRules, etc.) with the server.
 * 4. Binds the tool execution to the executor instance.
 *
 * @param accessToken - The Google OAuth2 access token for the authenticated user.
 * @returns A fully configured McpServer instance ready to be connected to a transport.
 */
export function createMcpServer(accessToken: string) {
  const server = new McpServer({
    name: "CEP Admin Hero",
    version: "1.0.0",
  });

  const executor = new CepToolExecutor(accessToken);

  server.tool(
    "getChromeEvents",
    "Get recent real Chrome security events and logs.",
    GetChromeEventsSchema.shape,
    async (args) => {
      const result = await executor.getChromeEvents(args);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    "listDLPRules",
    "List current DLP policies from Cloud Identity.",
    ListDLPRulesSchema.shape,
    async (_args) => {
      const result = await executor.listDLPRules();
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    "enrollBrowser",
    "Generate a real browser enrollment token.",
    EnrollBrowserSchema.shape,
    async (args) => {
      const result = await executor.enrollBrowser(args);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    "getChromeConnectorConfiguration",
    "Inspect Chrome connector configurations.",
    GetConnectorConfigSchema.shape,
    async (_args) => {
      const result = await executor.getChromeConnectorConfiguration();
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    "getFleetOverview",
    "Summarize fleet posture from live CEP data.",
    GetFleetOverviewSchema.shape,
    async (args) => {
      const result = await executor.getFleetOverview(args);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    "searchKnowledge",
    "Search help docs or policy references for grounding.",
    z.object({
      query: z.string().min(1),
      scope: z.enum(["docs", "policies"]).optional(),
      topK: z.number().min(1).max(8).optional(),
    }).shape,
    async (args) => {
      const topK = args.topK ?? 4;
      if (args.scope === "policies") {
        const result = await searchPolicies(args.query, topK);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }
      const result = await searchDocs(args.query, topK);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  return server;
}
