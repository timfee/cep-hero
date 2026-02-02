import { ActivityEntry } from "@/types/activity";

import { activityStore } from "./activity-store";

/**
 * Global event target for activity logging.
 * Decouples the fetcher from React's lifecycle.
 */
export const activityEvents = new EventTarget();

export function notifyActivity(entry: ActivityEntry) {
  // Update the synchronous store
  activityStore.addEntry(entry);

  // Also dispatch event for any non-React listeners
  activityEvents.dispatchEvent(new CustomEvent("activity", { detail: entry }));
}

/**
 * Resolve a URL string from a fetch input.
 */
function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof Request) {
    return input.url;
  }
  return input.href;
}

/**
 * Resolve an HTTP method from a fetch input.
 */
function getRequestMethod(input: RequestInfo | URL): string {
  if (input instanceof Request) {
    return input.method;
  }
  return "GET";
}

/**
 * A wrapped fetch client that instruments requests for the activity log.
 * Use this instead of global window.fetch to avoid monkey-patching and
 * improve reliability.
 */
export async function clientFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const requestUrl = getRequestUrl(input);
  const method = (init?.method || getRequestMethod(input)).toUpperCase();
  const start = performance.now();
  const id = crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  const timestamp = Date.now();

  const isMcp = requestUrl.includes("/api/mcp");
  const isWorkspace =
    /https?:\/\/(.*\.)?(googleapis\.com|google\.com)(\/|$)/i.test(requestUrl);

  let kind: ActivityEntry["kind"] | null = null;
  if (isMcp) {
    kind = "mcp";
  } else if (isWorkspace) {
    kind = "workspace";
  }

  // If this is not a request we care about tracking, use native fetch directly
  if (!kind) {
    return fetch(input, init);
  }

  try {
    const response = await fetch(input, init);
    const durationMs = Math.max(0, Math.round(performance.now() - start));

    // For MCP, we log immediately as it might be a stream
    if (kind === "mcp") {
      notifyActivity({
        id,
        url: requestUrl,
        method,
        status: response.status,
        durationMs,
        responsePreview: "MCP stream",
        timestamp,
        kind,
      });
      return response;
    }

    const contentType =
      response.headers.get("content-type")?.toLowerCase() ?? "";

    let responsePreview: string | undefined;

    if (kind === "workspace") {
      responsePreview =
        `${response.status} ${response.statusText || ""} ${contentType}`.trim();
    } else {
      const shouldReadBody =
        !contentType.includes("event-stream") &&
        !contentType.includes("octet-stream");

      if (shouldReadBody) {
        try {
          const clone = response.clone();
          const text = await clone.text();
          responsePreview = text.replace(/\s+/g, " ").trim().slice(0, 320);
        } catch {
          // Ignore body parsing errors
        }
      }
    }

    notifyActivity({
      id,
      url: requestUrl,
      method,
      status: response.status,
      durationMs,
      responsePreview,
      timestamp,
      kind,
    });

    return response;
  } catch (error) {
    const durationMs = Math.max(0, Math.round(performance.now() - start));
    const preview = error instanceof Error ? error.message : "Unknown error";

    notifyActivity({
      id,
      url: requestUrl,
      method,
      status: "error",
      durationMs,
      responsePreview: preview,
      timestamp,
      kind,
    });

    throw error;
  }
}
