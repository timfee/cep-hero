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
 * In-memory transport registry for MCP SSE sessions.
 */
export const transportMap = new Map<string, SSEServerTransport>();

/**
 * Create an MCP server with CEP tool registrations.
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
