import { randomUUID } from "node:crypto";

import { auth } from "@/lib/auth";
import { writeDebugLog } from "@/lib/debug-log";
import { createMcpServer } from "@/lib/mcp/server-factory";
import { NextJsSseTransport, activeTransports } from "@/lib/mcp/transport";

/**
 * Establish an SSE connection for MCP with auth fallback to session.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);

  const authHeader = req.headers.get("Authorization");
  let accessToken = authHeader?.replace("Bearer ", "");

  if (!accessToken) {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (session) {
      const accessTokenResponse = await auth.api.getAccessToken({
        body: {
          providerId: "google",
        },
        headers: req.headers,
      });

      if (accessTokenResponse?.accessToken) {
        ({ accessToken } = accessTokenResponse);
      }
    }
  }

  if (!accessToken) {
    return new Response("Missing access token", { status: 401 });
  }

  const sessionId = randomUUID();
  const transport = new NextJsSseTransport(sessionId);

  activeTransports.set(sessionId, transport);

  const mcpServer = createMcpServer(accessToken);

  mcpServer.connect(transport);

  const stream = new ReadableStream({
    start(controller) {
      transport.attachController(controller);

      const endpointUrl = `${url.origin}/api/mcp?session_id=${sessionId}`;
      const msg = `event: endpoint\ndata: ${endpointUrl}\n\n`;
      controller.enqueue(new TextEncoder().encode(msg));

      console.log(`[MCP] Session started: ${sessionId}`);
      void writeDebugLog("mcp.session.start", {
        sessionId,
        endpointUrl,
        hasAccessToken: Boolean(accessToken),
      });
    },
    cancel() {
      console.log(`[MCP] Session closed: ${sessionId}`);
      void writeDebugLog("mcp.session.close", { sessionId });
      activeTransports.delete(sessionId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/**
 * Handle MCP JSON-RPC messages for an active SSE session.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session_id");

  if (!sessionId) {
    return new Response("Missing session_id query parameter", { status: 400 });
  }

  const transport = activeTransports.get(sessionId);
  if (!transport) {
    return new Response(
      "Session not found (or expired). Reconnect to GET /api/mcp",
      { status: 404 }
    );
  }

  try {
    const body = await req.json();
    await writeDebugLog("mcp.message.in", { sessionId, body });
    await transport.handlePostMessage(body);

    return new Response("Accepted", { status: 202 });
  } catch (error) {
    console.error("[MCP] Error handling POST:", error);
    if (error instanceof Error && "message" in error) {
      return new Response(error.message, { status: 400 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}
