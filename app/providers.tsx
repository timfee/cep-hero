"use client";

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

    window.fetch = async (input, init) => {
      const requestUrl = typeof input === "string" ? input : input.url;
      const method = (
        init?.method || (input instanceof Request ? input.method : "GET")
      ).toUpperCase();
      const start = performance.now();
      const id = crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
      const timestamp = Date.now();

      const isMcp = requestUrl.includes("/api/mcp");
      const isWorkspace = /https?:\/\/(.*\.)?(googleapis\.com|google\.com)(\/|$)/i.test(
        requestUrl
      );

      let kind: ActivityEntry["kind"] | null = null;
      if (isMcp) {
        kind = "mcp";
      } else if (isWorkspace) {
        kind = "workspace";
      }

      if (!kind) {
        return originalFetch(input as RequestInfo, init as RequestInit);
      }

      try {
        const response = await originalFetch(
          input as RequestInfo,
          init as RequestInit
        );
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
          responsePreview = `${response.status} ${response.statusText || ""} ${contentType}`.trim();
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
    };

    return () => {
      window.fetch = originalFetch;
      isPatchedRef.current = false;
    };
  }, [log]);
}

function ActivityPanel({ isOpen }: { isOpen: boolean }) {
  const { entries, setOpen, filter } = useActivityLogContext();

  const items = useMemo(() => {
    const filtered =
      filter === "all" ? entries : entries.filter((e) => e.kind === filter);
    return filtered.slice(0, 30);
  }, [entries, filter]);

  if (!isOpen) return null;

  return (
    <div className="pointer-events-auto fixed right-4 top-20 z-50 w-[420px] max-h-[70vh] overflow-y-auto rounded-2xl border border-white/10 bg-black/90 p-4 text-sm shadow-2xl backdrop-blur">
      <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-zinc-500">
        <span>
          Recent Activity ({filter === "all" ? "All" : filter.toUpperCase()})
        </span>
        <button
          type="button"
          className="rounded-full bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-zinc-400 hover:bg-white/10"
          onClick={() => setOpen(false)}
        >
          Close
        </button>
      </div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="rounded-lg border border-white/5 bg-white/5 px-3 py-4 text-xs text-zinc-500">
            No activity yet. Requests will appear here.
          </div>
        ) : (
          items.map((entry) => {
            const statusColor =
              entry.status === "error"
                ? "text-red-400"
                : entry.status >= 500
                  ? "text-red-300"
                  : entry.status >= 400
                    ? "text-amber-300"
                    : "text-emerald-300";

            const pathname = (() => {
              try {
                const parsed = new URL(entry.url, window.location.origin);
                return `${parsed.pathname}${parsed.search}`;
              } catch {
                return entry.url;
              }
            })();

            return (
              <div
                key={entry.id}
                className="rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-zinc-200"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                      {entry.method}
                    </span>
                    <span className="text-zinc-300">{pathname}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    <span className={statusColor}>{entry.status}</span>
                    <span className="text-zinc-600">•</span>
                    <span>{entry.durationMs}ms</span>
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-blue-300">
                    {entry.kind === "mcp" ? "MCP" : "Workspace"}
                  </span>
                  <span>
                    {new Date(entry.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
                {entry.responsePreview ? (
                  <div className="mt-2 rounded-lg border border-white/5 bg-black/40 px-2 py-2 text-[11px] text-zinc-400">
                    {entry.responsePreview}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
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
