import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  CepToolExecutor,
  GetChromeEventsSchema,
  ListDLPRulesSchema,
  EnrollBrowserSchema,
  GetConnectorConfigSchema,
  GetFleetOverviewSchema,
  ListOrgUnitsSchema,
} from "@/lib/mcp/registry";
import { searchDocs, searchPolicies } from "@/lib/upstash/search";

/**
 * Create an MCP server with CEP tool registrations.
 */
export function createMcpServer(accessToken: string) {
  const server = new McpServer({
    name: "CEP Admin Hero",
    version: "1.0.0",
  });

  const executor = new CepToolExecutor(accessToken);

  server.registerTool(
    "getChromeEvents",
    {
      description: "Get recent real Chrome security events and logs.",
      inputSchema: GetChromeEventsSchema,
    },
    async (args) => {
      const result = await executor.getChromeEvents(args);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.registerTool(
    "listDLPRules",
    {
      description: "List current DLP policies from Cloud Identity.",
      inputSchema: ListDLPRulesSchema,
    },
    async (_args) => {
      const result = await executor.listDLPRules();
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.registerTool(
    "enrollBrowser",
    {
      description: "Generate a real browser enrollment token.",
      inputSchema: EnrollBrowserSchema,
    },
    async (args) => {
      const result = await executor.enrollBrowser(args);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.registerTool(
    "listOrgUnits",
    {
      description: "List all organizational units (OUs).",
      inputSchema: ListOrgUnitsSchema,
    },
    async (_args) => {
      const result = await executor.listOrgUnits();
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.registerTool(
    "getChromeConnectorConfiguration",
    {
      description: "Inspect Chrome connector configurations.",
      inputSchema: GetConnectorConfigSchema,
    },
    async (_args) => {
      const result = await executor.getChromeConnectorConfiguration();
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.registerTool(
    "getFleetOverview",
    {
      description: "Summarize fleet posture from live CEP data.",
      inputSchema: GetFleetOverviewSchema,
    },
    async (args) => {
      const result = await executor.getFleetOverview(args);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.registerTool(
    "searchKnowledge",
    {
      description: "Search help docs or policy references for grounding.",
      inputSchema: z.object({
        query: z.string().min(1),
        scope: z.enum(["docs", "policies"]).optional(),
        topK: z.number().min(1).max(8).optional(),
      }),
    },
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
