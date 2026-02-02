"use client";

import { X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ActivityEntry = {
  id: string;
  url: string;
  method: string;
  status: number | "error";
  durationMs: number;
  responsePreview?: string;
  timestamp: number;
  kind: "mcp" | "workspace";
};

type ActivityFilter = "all" | "mcp" | "workspace";

type ActivityLogContextValue = {
  entries: ActivityEntry[];
  log: (entry: ActivityEntry) => void;
  setOpen: (open: boolean) => void;
  setFilter: (filter: ActivityFilter) => void;
  filter: ActivityFilter;
};

const ActivityLogContext = createContext<ActivityLogContextValue | null>(null);

function useActivityLogContext() {
  const context = useContext(ActivityLogContext);
  if (!context) {
    throw new Error("ActivityLogContext is missing");
  }
  return context;
}

export function useActivityLog() {
  return useActivityLogContext();
}

function useFetchInstrumentation(
  log: (entry: ActivityEntry) => void,
  isOpen: boolean
) {
  const isPatchedRef = useRef(false);
  const isOpenRef = useRef(isOpen);

  useLayoutEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (typeof window === "undefined" || isPatchedRef.current) {
      return;
    }
    const originalFetch = window.fetch;
    isPatchedRef.current = true;

    type FetchArgs = Parameters<typeof originalFetch>;

    async function fetchPatched(
      ...args: FetchArgs
    ): ReturnType<typeof originalFetch> {
      const [input, init] = args;
      const requestUrl = getRequestUrl(input);
      const method = (init?.method || getRequestMethod(input)).toUpperCase();
      const start = performance.now();
      const id = crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
      const timestamp = Date.now();

      const isMcp = requestUrl.includes("/api/mcp");
      const isWorkspace =
        /https?:\/\/(.*\.)?(googleapis\.com|google\.com)(\/|$)/i.test(
          requestUrl
        );

      let kind: ActivityEntry["kind"] | null = null;
      if (isMcp) {
        kind = "mcp";
      } else if (isWorkspace) {
        kind = "workspace";
      }

      if (!kind) {
        return originalFetch(...args);
      }

      try {
        const response = await originalFetch(...args);
        const durationMs = Math.max(0, Math.round(performance.now() - start));

        // Capture streaming MCP responses by logging immediately if MCP (body may not be readable)
        if (kind === "mcp") {
          log({
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
        const shouldReadBody =
          !contentType.includes("event-stream") &&
          !contentType.includes("octet-stream");

        let responsePreview: string | undefined;

        if (kind === "workspace") {
          const contentType =
            response.headers.get("content-type")?.toLowerCase() ?? "";
          responsePreview =
            `${response.status} ${response.statusText || ""} ${contentType}`.trim();
        } else if (shouldReadBody) {
          try {
            const clone = response.clone();
            const text = await clone.text();
            responsePreview = text.replace(/\s+/g, " ").trim().slice(0, 320);
          } catch {
            // Ignore body parsing errors to avoid interfering with streaming responses
          }
        }

        log({
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
        const preview =
          error instanceof Error ? error.message : "Unknown error";
        log({
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

    const patchedFetch = fetchPatched as typeof window.fetch;
    Object.assign(patchedFetch, originalFetch);
    window.fetch = patchedFetch;

    return () => {
      window.fetch = originalFetch;
      isPatchedRef.current = false;
    };
  }, [log]);
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

function ActivityPanel({ isOpen }: { isOpen: boolean }) {
  const { entries, setOpen, filter, setFilter } = useActivityLogContext();

  const items = useMemo(() => {
    const filtered =
      filter === "all" ? entries : entries.filter((e) => e.kind === filter);
    return filtered.slice(0, 30);
  }, [entries, filter]);

  if (!isOpen) return null;

  const filterOptions: { value: ActivityFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "mcp", label: "MCP" },
    { value: "workspace", label: "Workspace" },
  ];

  return (
    <aside
      className="pointer-events-auto fixed right-4 top-20 z-50 w-[420px] max-h-[70vh] overflow-hidden rounded-xl border border-border bg-card shadow-lg"
      role="dialog"
      aria-label="Activity log"
    >
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">
            Recent Activity
          </h2>
          <p className="text-xs text-muted-foreground">
            {items.length} request{items.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter Tabs */}
          <div
            className="flex gap-1"
            role="tablist"
            aria-label="Filter activity"
          >
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={filter === option.value}
                onClick={() => setFilter(option.value)}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  filter === option.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen(false)}
            aria-label="Close activity panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="max-h-[calc(70vh-60px)] overflow-y-auto p-3">
        {items.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted/50 px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No activity yet. Requests will appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2" aria-label="Activity entries">
            {items.map((entry) => {
              const statusColor =
                entry.status === "error"
                  ? "text-destructive"
                  : entry.status >= 500
                    ? "text-destructive"
                    : entry.status >= 400
                      ? "text-status-warning"
                      : "text-status-positive";

              const pathname = (() => {
                try {
                  const parsed = new URL(entry.url, window.location.origin);
                  return `${parsed.pathname}${parsed.search}`;
                } catch {
                  return entry.url;
                }
              })();

              return (
                <li
                  key={entry.id}
                  className="rounded-lg border border-border bg-card p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {entry.method}
                      </Badge>
                      <span className="truncate text-xs text-foreground">
                        {pathname}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-xs">
                      <span className={cn("font-medium", statusColor)}>
                        {entry.status}
                      </span>
                      <span className="text-muted-foreground">
                        {entry.durationMs}ms
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge
                      variant={entry.kind === "mcp" ? "default" : "outline"}
                      className="h-5 text-[10px]"
                    >
                      {entry.kind === "mcp" ? "MCP" : "Workspace"}
                    </Badge>
                    <time dateTime={new Date(entry.timestamp).toISOString()}>
                      {new Date(entry.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </time>
                  </div>
                  {entry.responsePreview && (
                    <div className="mt-2 rounded-md border border-border bg-muted/50 px-2 py-2 font-mono text-xs text-muted-foreground">
                      <span className="line-clamp-2">
                        {entry.responsePreview}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<ActivityFilter>("all");

  const log = useCallback((entry: ActivityEntry) => {
    setEntries((current) => [entry, ...current].slice(0, 50));
  }, []);

  useFetchInstrumentation(log, isOpen);

  const value = useMemo<ActivityLogContextValue>(
    () => ({ entries, log, setOpen: setIsOpen, filter, setFilter }),
    [entries, log, filter]
  );

  return (
    <ActivityLogContext.Provider value={value}>
      {children}
      <ActivityPanel isOpen={isOpen} />
    </ActivityLogContext.Provider>
  );
}
