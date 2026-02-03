import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { describe, expect, it } from "bun:test";

import { createMcpServer } from "@/lib/mcp/server-factory";

const PROTOCOL_VERSION = "2025-03-26";

type JsonRpcMessage = {
  jsonrpc: string;
  id?: number | string | null;
  result?: unknown;
  error?: unknown;
};

function parseSseMessages(payload: string): JsonRpcMessage[] {
  const messages: JsonRpcMessage[] = [];
  const chunks = payload
    .split("\n\n")
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);

  for (const chunk of chunks) {
    const dataLines = chunk
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => line.slice("data: ".length));

    if (dataLines.length === 0) {
      continue;
    }

    const raw = dataLines.join("\n").trim();
    if (!raw) {
      continue;
    }

    const parsed = JSON.parse(raw) as JsonRpcMessage;
    messages.push(parsed);
  }

  return messages;
}

function isJsonRpcResponse(
  message: JsonRpcMessage
): message is JsonRpcMessage & { id: number | string | null } {
  return message.jsonrpc === "2.0" && "id" in message;
}

describe("MCP Streamable HTTP transport", () => {
  it("initializes and accepts follow-up notifications", async () => {
    let initializedSessionId: string | undefined;
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => "session-1",
      onsessioninitialized: (sessionId) => {
        initializedSessionId = sessionId;
      },
    });

    const mcpServer = createMcpServer("test-token");
    await mcpServer.connect(transport);

    const initRequest = new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: "test-client", version: "0.0.0" },
        },
      }),
    });

    const initResponse = await transport.handleRequest(initRequest);
    expect(initResponse.status).toBe(200);
    expect(initResponse.headers.get("mcp-session-id")).toBe("session-1");
    expect(initializedSessionId).toBe("session-1");

    const initPayload = await initResponse.text();
    const initMessages = parseSseMessages(initPayload);
    const initResponseMessage = initMessages.find(
      (message) => isJsonRpcResponse(message) && message.id === 1
    );

    expect(initResponseMessage).toBeTruthy();
    expect(initResponseMessage?.result).toBeDefined();

    const followUpRequest = new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-session-id": "session-1",
        "mcp-protocol-version": PROTOCOL_VERSION,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    });

    const followUpResponse = await transport.handleRequest(followUpRequest);
    expect(followUpResponse.status).toBe(202);
  });
});
