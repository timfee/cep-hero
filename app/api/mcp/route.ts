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

async function handleExistingSession(
  sessionId: string,
  req: Request
): Promise<Response | null> {
  const entry = activeTransports.get(sessionId);
  if (!entry) {
    return new Response("Session not found (or expired).", { status: 404 });
  }
  touchSession(sessionId);
  const response = await entry.transport.handleRequest(req);
  return response as Response;
}

function extractBearerToken(authHeader: string | null): string | undefined {
  if (typeof authHeader !== "string") {
    return undefined;
  }
  const token = authHeader.replace("Bearer ", "");
  return token.length > 0 ? token : undefined;
}

async function resolveAccessTokenFromSession(
  req: Request
): Promise<string | undefined> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (session === null || session === undefined) {
    return undefined;
  }
  const response = await auth.api.getAccessToken({
    body: { providerId: "google" },
    headers: req.headers,
  });
  const token = response?.accessToken;
  return typeof token === "string" && token.length > 0 ? token : undefined;
}

async function resolveAccessToken(req: Request): Promise<string | undefined> {
  const bearerToken = extractBearerToken(req.headers.get("Authorization"));
  return bearerToken ?? (await resolveAccessTokenFromSession(req));
}

function createMcpTransport(sessionCreatedAt: number) {
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
  return transport;
}

async function initializeNewSession(
  req: Request,
  accessToken: string
): Promise<Response> {
  const transport = createMcpTransport(Date.now());
  const mcpServer = createMcpServer(accessToken);
  await mcpServer.connect(transport);
  const response = await transport.handleRequest(req);
  return response as Response;
}

/**
 * Handle MCP Streamable HTTP POST/initialize requests.
 */
export async function POST(req: Request) {
  await sweepExpiredSessions();
  const existingSessionId = getSessionId(req);
  if (existingSessionId !== null && existingSessionId !== "") {
    return handleExistingSession(existingSessionId, req);
  }

  const accessToken = await resolveAccessToken(req);
  if (accessToken === undefined || accessToken.length === 0) {
    return new Response("Missing access token", { status: 401 });
  }

  return initializeNewSession(req, accessToken);
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
