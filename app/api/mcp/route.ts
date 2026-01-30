import { randomUUID } from "crypto";

import { auth } from "@/lib/auth";
import { createMcpServer } from "@/lib/mcp/server-factory";
import { NextJsSseTransport, activeTransports } from "@/lib/mcp/transport";

/**
 * GET /api/mcp
 *
 * Establishes a Server-Sent Events (SSE) connection for the Model Context Protocol.
 *
 * Authentication:
 * - Checks for `Authorization: Bearer <token>` header (standard for CLI/Tools).
 * - Falls back to NextAuth session (for browser-based debugging).
 *
 * Flow:
 * 1. Validate Auth.
 * 2. Generate Session ID.
 * 3. Initialize MCP Server with the user's credentials.
 * 4. Open SSE Stream and send the `endpoint` event.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);

  // --- 1. Authentication ---
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
        accessToken = accessTokenResponse.accessToken;
      }
    }
  }

  // Require OAuth token; no ADC fallback for safety.
  if (!accessToken) {
    return new Response("Missing access token", { status: 401 });
  }

  // --- 2. Transport & Server Setup ---
  const sessionId = randomUUID();
  const transport = new NextJsSseTransport(sessionId);

  // Store transport in memory to handle subsequent POST requests
  activeTransports.set(sessionId, transport);

  // Initialize the MCP Server logic.
  const mcpServer = createMcpServer(accessToken);

  // Connect the SDK to our custom transport
  mcpServer.connect(transport);

  // --- 3. Stream Response ---
  const stream = new ReadableStream({
    start(controller) {
      // Attach controller to transport so it can push messages
      transport.attachController(controller);

      // Send initial 'endpoint' event as per MCP SSE specification
      // This tells the client where to send JSON-RPC POST requests
      const endpointUrl = `${url.origin}/api/mcp?session_id=${sessionId}`;
      const msg = `event: endpoint\ndata: ${endpointUrl}\n\n`;
      controller.enqueue(new TextEncoder().encode(msg));

      console.log(`[MCP] Session started: ${sessionId}`);
    },
    cancel() {
      console.log(`[MCP] Session closed: ${sessionId}`);
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
 * POST /api/mcp
 *
 * Handles incoming JSON-RPC 2.0 messages from the MCP Client.
 * Routes the message to the correct active Transport based on `session_id`.
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
    // Pass the parsed JSON-RPC message to the transport
    await transport.handlePostMessage(body);

    // MCP over SSE expects a 202 Accepted for valid POSTs
    return new Response("Accepted", { status: 202 });
  } catch (error) {
    console.error("[MCP] Error handling POST:", error);
    if (error instanceof Error && "message" in error) {
      return new Response(error.message, { status: 400 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}
