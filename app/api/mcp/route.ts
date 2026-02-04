/**
 * MCP (Model Context Protocol) API route for tool execution.
 * Manages session lifecycle and handles streamable HTTP transport.
 */

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

/**
 * Extract session ID from request headers.
 */
function getSessionId(req: Request) {
  return req.headers.get("mcp-session-id");
}

/**
 * Close and remove sessions that have exceeded the TTL.
 */
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

/**
 * Update the last-seen timestamp for a session.
 */
function touchSession(sessionId: string) {
  const entry = activeTransports.get(sessionId);
  if (!entry) {
    return;
  }
  entry.lastSeenAt = Date.now();
}

/**
 * Handle MCP Streamable HTTP requests for existing sessions.
 */
export async function GET(req: Request) {
  await sweepExpiredSessions();
  const sessionId = getSessionId(req);
  if (!sessionId) {
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
 * Handle requests for existing MCP sessions.
 */
async function handleExistingSession(
  sessionId: string,
  req: Request
): Promise<Response> {
  const entry = activeTransports.get(sessionId);
  if (!entry) {
    return new Response("Session not found (or expired).", { status: 404 });
  }
  touchSession(sessionId);
  const response = await entry.transport.handleRequest(req);
  return response as Response;
}

/**
 * Extract bearer token from Authorization header.
 */
function extractBearerToken(authHeader: string | null): string | undefined {
  if (!authHeader) {
    return undefined;
  }
  const token = authHeader.replace("Bearer ", "");
  return token || undefined;
}

/**
 * Resolve Google access token from the user's session.
 */
async function resolveAccessTokenFromSession(
  req: Request
): Promise<string | undefined> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return undefined;
  }
  const response = await auth.api.getAccessToken({
    body: { providerId: "google" },
    headers: req.headers,
  });
  return response?.accessToken || undefined;
}

/**
 * Resolve access token from bearer header or session.
 */
async function resolveAccessToken(req: Request): Promise<string | undefined> {
  const bearerToken = extractBearerToken(req.headers.get("Authorization"));
  return bearerToken ?? (await resolveAccessTokenFromSession(req));
}

/**
 * Create a new MCP transport with session tracking callbacks.
 */
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

/**
 * Initialize a new MCP session with the given access token.
 */
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
  if (existingSessionId) {
    return handleExistingSession(existingSessionId, req);
  }

  const accessToken = await resolveAccessToken(req);
  if (!accessToken) {
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
  if (!sessionId) {
    return new Response("Missing mcp-session-id header", { status: 400 });
  }

  const entry = activeTransports.get(sessionId);
  if (!entry) {
    return new Response("Session not found (or expired).", { status: 404 });
  }

  touchSession(sessionId);
  return entry.transport.handleRequest(req);
}
