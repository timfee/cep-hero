import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { auth } from "@/lib/auth";
import { createMcpServer } from "@/lib/mcp/server-factory";

const SESSION_TTL_MS = 30 * 60 * 1000;

interface SessionEntry {
  transport: WebStandardStreamableHTTPServerTransport;
  createdAt: number;
  lastSeenAt: number;
}

const activeTransports = new Map<string, SessionEntry>();

function getSessionId(req: Request) {
  return req.headers.get("mcp-session-id");
}

async function sweepExpiredSessions(now = Date.now()) {
  const expired: string[] = [];
  for (const [sessionId, entry] of activeTransports.entries()) {
    if (now - entry.lastSeenAt > SESSION_TTL_MS) {
      expired.push(sessionId);
    }
  }

  await Promise.all(
    expired.map(async (sessionId) => {
      const entry = activeTransports.get(sessionId);
      if (!entry) {
        return;
      }
      try {
        await entry.transport.close();
      } catch (error) {
        console.warn(`[MCP] Failed to close session ${sessionId}`, error);
      } finally {
        activeTransports.delete(sessionId);
      }
    })
  );
}

function touchSession(sessionId: string) {
  const entry = activeTransports.get(sessionId);
  if (!entry) {
    return;
  }
  entry.lastSeenAt = Date.now();
}

/**
 * Handle MCP Streamable HTTP requests.
 */
export async function GET(req: Request) {
  await sweepExpiredSessions();
  const sessionId = getSessionId(req);
  if (sessionId === null || sessionId === "") {
    return new Response("Missing mcp-session-id header", { status: 400 });
  }

  const entry = activeTransports.get(sessionId);
  if (!entry) {
    return new Response("Session not found (or expired).", { status: 404 });
  }

  touchSession(sessionId);
  return entry.transport.handleRequest(req);
}

/**
 * Handle MCP Streamable HTTP POST/initialize requests.
 */
export async function POST(req: Request) {
  await sweepExpiredSessions();
  const existingSessionId = getSessionId(req);
  if (existingSessionId !== null && existingSessionId !== "") {
    const entry = activeTransports.get(existingSessionId);
    if (!entry) {
      return new Response("Session not found (or expired).", { status: 404 });
    }

    touchSession(existingSessionId);
    return entry.transport.handleRequest(req);
  }

  const authHeader = req.headers.get("Authorization");
  let accessToken =
    typeof authHeader === "string"
      ? authHeader.replace("Bearer ", "")
      : undefined;
  if (accessToken === "") {
    accessToken = undefined;
  }

  if (accessToken === undefined) {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (session !== null && session !== undefined) {
      const accessTokenResponse = await auth.api.getAccessToken({
        body: {
          providerId: "google",
        },
        headers: req.headers,
      });

      const tokenCandidate = accessTokenResponse?.accessToken;
      if (typeof tokenCandidate === "string" && tokenCandidate.length > 0) {
        accessToken = tokenCandidate;
      }
    }
  }

  if (accessToken === undefined || accessToken.length === 0) {
    return new Response("Missing access token", { status: 401 });
  }

  const sessionCreatedAt = Date.now();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    onsessioninitialized: (sessionId) => {
      activeTransports.set(sessionId, {
        transport,
        createdAt: sessionCreatedAt,
        lastSeenAt: Date.now(),
      });
      console.log(`[MCP] Session started: ${sessionId}`);
    },
    onsessionclosed: (sessionId) => {
      activeTransports.delete(sessionId);
      console.log(`[MCP] Session closed: ${sessionId}`);
    },
  });

  const mcpServer = createMcpServer(accessToken);
  await mcpServer.connect(transport);

  return transport.handleRequest(req);
}

/**
 * Handle MCP session termination.
 */
export async function DELETE(req: Request) {
  await sweepExpiredSessions();
  const sessionId = getSessionId(req);
  if (sessionId === null || sessionId === "") {
    return new Response("Missing mcp-session-id header", { status: 400 });
  }

  const entry = activeTransports.get(sessionId);
  if (!entry) {
    return new Response("Session not found (or expired).", { status: 404 });
  }

  touchSession(sessionId);
  return entry.transport.handleRequest(req);
}
