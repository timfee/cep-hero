/**
 * Tests that expected MCP tools are registered by the server factory.
 * Update EXPECTED_TOOLS when adding or removing tools from the MCP server.
 */

import { describe, expect, it, mock } from "bun:test";

/**
 * Expected tool names that must be registered in the MCP server.
 * This list should be updated when new tools are added.
 */
const EXPECTED_TOOLS = [
  "getChromeEvents",
  "listDLPRules",
  "enrollBrowser",
  "listOrgUnits",
  "getChromeConnectorConfiguration",
  "getFleetOverview",
  "searchKnowledge",
  "createDLPRule",
  "draftPolicyChange",
  "applyPolicyChange",
];

describe("MCP server tool registration", () => {
  it("registers all expected tools", async () => {
    const registeredTools: string[] = [];

    // Mock McpServer to capture registerTool calls
    mock.module("@modelcontextprotocol/sdk/server/mcp.js", () => ({
      McpServer: class {
        registerTool(name: string) {
          registeredTools.push(name);
        }
      },
    }));

    // Mock search dependencies so the factory doesn't fail on import
    mock.module("@/lib/upstash/search", () => ({
      searchDocs: () => Promise.resolve([]),
      searchPolicies: () => Promise.resolve([]),
    }));

    // Re-import the factory so it picks up the mocked McpServer
    const { createMcpServer } = await import("./server-factory");
    createMcpServer("fake-token");

    for (const tool of EXPECTED_TOOLS) {
      expect(registeredTools).toContain(tool);
    }

    expect(registeredTools).toHaveLength(EXPECTED_TOOLS.length);
  });
});
