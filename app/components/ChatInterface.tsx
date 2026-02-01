"use client";

import { useChat } from "@ai-sdk/react";
import { Send, Shield, LogOut, Command, ArrowRight } from "lucide-react";
import {
  useRef,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { authClient } from "@/lib/auth-client";

import { useActivityLog } from "../providers";
import { MessageBubble } from "./chat/MessageBubble";

type OverviewCard = {
  label: string;
  value: string;
  note: string;
  source: string;
  action: string;
  lastUpdated?: string;
};

type OverviewData = {
  headline: string;
  summary: string;
  postureCards: OverviewCard[];
  suggestions: string[];
  sources: string[];
};

export default function ChatInterface() {
  const { data: session, isPending } = authClient.useSession();
  const { messages, sendMessage, status: chatStatus } = useChat();
  const { entries, setOpen, setFilter } = useActivityLog();

  const [input, setInput] = useState("");
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const isLoading = chatStatus === "streaming" || chatStatus === "submitted";

  const overviewSuggestions = overview?.suggestions?.length
    ? overview.suggestions
    : (overview?.postureCards.map((card) => card.action) ?? [
        "List active DLP rules",
        "Show recent Chrome events",
        "Check connector configuration",
      ]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const mcpCount = useMemo(
    () => entries.filter((entry) => entry.kind === "mcp").length,
    [entries]
  );
  const workspaceCount = useMemo(
    () => entries.filter((entry) => entry.kind === "workspace").length,
    [entries]
  );

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    setInput(e.target.value);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    const currentInput = input;
    setInput("");

    await sendMessage({ text: currentInput });
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on load
  useEffect(() => {
    if (!isPending && session) {
      inputRef.current?.focus();
    }
  }, [isPending, session]);

  useEffect(() => {
    if (!session) {
      setOverview(null);
      setOverviewError(null);
      return;
    }

    let isActive = true;

    async function loadOverview() {
      try {
        const response = await fetch("/api/overview");
        if (!response.ok) {
          throw new Error("Unable to load overview");
        }
        const data = await response.json();
        const overview = parseOverviewResponse(data);

        if (isActive && overview) {
          setOverview(overview);
          setOverviewError(null);
        }
      } catch (error) {
        console.warn("[overview] fetch failed", {
          message: getErrorMessage(error),
        });
        if (isActive) {
          setOverview(null);
          setOverviewError("Unable to load overview data");
        }
      }
    }

    void loadOverview();

    return () => {
      isActive = false;
    };
  }, [session]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          Loading session…
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-center">
        <div className="w-full max-w-md space-y-8">
          <div className="flex justify-center">
            <div className="rounded-2xl bg-blue-600/10 p-4 ring-1 ring-blue-600/20">
              <Shield className="h-10 w-10 text-blue-500" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-medium tracking-tight text-white">
              CEP Admin Hero
            </h1>
            <p className="text-sm text-zinc-400">
              The AI-powered command center for Chrome Enterprise.
              <br />
              Manage DLP, Insights, and Devices with natural language.
            </p>
          </div>
          <button
            onClick={() =>
              authClient.signIn.social({
                provider: "google",
                callbackURL: "/",
              })
            }
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-white px-8 py-3.5 text-sm font-medium text-black transition-all hover:bg-zinc-200"
          >
            Connect Workspace
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-black font-sans text-zinc-100 selection:bg-blue-500/30">
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b border-white/5 bg-black/50 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
            <Shield className="h-4 w-4 text-zinc-300" />
          </div>
          <span className="text-sm font-medium tracking-tight">
            CEP Admin Hero
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden text-xs text-zinc-500 md:block">
            {session.user?.email}
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            <button
              type="button"
              className="cursor-pointer rounded-full bg-white/5 px-3 py-1 text-zinc-400 transition hover:bg-white/10"
              onClick={() => {
                setFilter("mcp");
                setOpen(true);
              }}
            >
              MCP
              <span className="ml-2 inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {mcpCount ? (
                <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-200">
                  {mcpCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              className="cursor-pointer rounded-full bg-white/5 px-3 py-1 text-zinc-400 transition hover:bg-white/10"
              onClick={() => {
                setFilter("workspace");
                setOpen(true);
              }}
            >
              Workspace
              <span className="ml-2 inline-flex h-1.5 w-1.5 rounded-full bg-blue-400" />
              {workspaceCount ? (
                <span className="ml-2 rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] text-blue-200">
                  {workspaceCount}
                </span>
              ) : null}
            </button>
          </div>
          <button
            onClick={() => authClient.signOut()}
            className="rounded-full p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Messages Area */}
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto px-4 py-8 md:px-8 lg:px-32 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800 scroll-smooth"
          onWheel={() => {
            if (scrollRef.current) {
              scrollRef.current.style.scrollBehavior = "auto";
            }
          }}
        >
          {messages.length === 0 ? (
            <div className="mx-auto flex h-full w-full max-w-5xl flex-col justify-center gap-10 px-2 opacity-100 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-700">
              <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] transition-all duration-300 will-change-transform">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-zinc-400">
                    Overview
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {overview ? "Live" : "Gathering"}
                  </div>
                  <h2 className="text-3xl font-medium leading-tight text-white">
                    {overview?.headline ??
                      "I am pulling a live snapshot of your Chrome fleet."}
                  </h2>
                  <p className="text-sm text-zinc-400">
                    {overview?.summary ??
                      "Hang tight while I assemble your current posture."}
                  </p>
                  <div className="pt-2 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
                    {overview
                      ? "Live summary from your environment"
                      : "Collecting live signals"}
                    {!overview && (
                      <span className="flex items-center gap-3 text-[11px]">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-blue-500/80 opacity-70" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                        </span>
                        Fetching events · Resolving policies · Checking DLP
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] transition-transform duration-300 hover:-translate-y-0.5">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      <span>Current Posture</span>
                      {overview?.sources?.length ? (
                        <span className="text-[10px] text-zinc-600">
                          Sources: {overview.sources.join(" · ")}
                        </span>
                      ) : null}
                    </div>
                    {overview ? (
                      <div className="grid gap-3">
                        {overview.postureCards.map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => {
                              setInput(item.action);
                              inputRef.current?.focus();
                            }}
                            className="rounded-xl border border-white/5 bg-black/40 p-4 text-left transition-all hover:border-white/20 hover:bg-white/10"
                          >
                            <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-zinc-500">
                              <span>{item.label}</span>
                              <span className="text-[10px] text-zinc-600">
                                {item.source}
                              </span>
                            </div>
                            <div className="mt-2 text-lg font-medium text-white">
                              {item.value}
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">
                              {item.note}
                            </div>
                            <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-zinc-600">
                              {item.lastUpdated
                                ? `Last updated ${new Date(item.lastUpdated).toLocaleString()}`
                                : "Last updated: unknown"}
                            </div>
                            <div className="mt-3 text-xs text-blue-400">
                              {item.action}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-3 rounded-xl border border-white/5 bg-black/40 p-8 text-xs uppercase tracking-[0.2em] text-zinc-500">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-blue-500 opacity-70" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                        </span>
                        {overviewError ?? "Thinking through your environment"}
                        <span className="text-[10px] text-zinc-600">
                          Running evidence checks
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    Recommended Next Steps
                  </div>
                  <div className="mt-4 space-y-3">
                    {overviewSuggestions.map((action) => (
                      <button
                        key={action}
                        onClick={() => {
                          setInput(action);
                          inputRef.current?.focus();
                        }}
                        className="flex w-full items-center justify-between rounded-xl border border-white/5 bg-black/40 px-4 py-3 text-sm text-zinc-300 transition-all hover:border-white/20 hover:bg-white/10"
                      >
                        <span>{action}</span>
                        <ArrowRight className="h-4 w-4 opacity-60" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    Ask Me Anything
                  </div>
                  <div className="mt-4 grid gap-3">
                    {[
                      "Why are my uploads not blocked?",
                      "List active DLP rules",
                      "Show recent high-risk events",
                      "Enroll new devices in Engineering",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => {
                          setInput(suggestion);
                        }}
                        className="flex items-center justify-between rounded-xl border border-white/5 bg-black/40 px-4 py-3 text-sm text-zinc-400 transition-all hover:bg-white/10 hover:text-zinc-200 group"
                      >
                        {suggestion}
                        <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6">
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <button
                  type="button"
                  className="rounded-full border border-white/10 px-3 py-1 transition hover:border-white/30 hover:text-white"
                  onClick={() => {
                    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                    setInput("");
                  }}
                >
                  Return to overview
                </button>
              </div>

              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              {isLoading && (
                <div className="flex w-full items-center justify-center py-4">
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-600 [animation-delay:-0.3s]" />
                  <div className="mx-1 h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-600 [animation-delay:-0.15s]" />
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-600" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Gradient Fade for Bottom */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
      </div>

      {/* Input Area */}
      <div className="mx-auto w-full max-w-3xl px-4 pb-6">
        <form
          onSubmit={handleSubmit}
          className="relative flex items-center overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-white/10 focus-within:ring-blue-500/50 transition-all"
        >
          <div className="flex h-14 w-14 items-center justify-center text-zinc-500">
            <Command className="h-5 w-5" />
          </div>
          <input
            ref={inputRef}
            className="flex-1 bg-transparent py-4 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
            placeholder="Ask anything about your Chrome fleet..."
            value={input}
            onChange={handleInputChange}
          />
          <button
            type="submit"
            disabled={!input || isLoading}
            className="mr-2 rounded-xl p-2.5 text-zinc-400 transition-all hover:bg-blue-600 hover:text-white disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Validate overview responses from the API.
 */
function parseOverviewResponse(value: unknown): OverviewData | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const headline = getOptionalString(value, "headline");
  const summary = getOptionalString(value, "summary");
  const suggestions = getStringArray(value, "suggestions");
  const sources = getStringArray(value, "sources");
  const postureCards = getOverviewCards(value);

  if (!headline || !summary || postureCards.length === 0) {
    return null;
  }

  return {
    headline,
    summary,
    postureCards,
    suggestions,
    sources,
  };
}

/**
 * Parse overview cards from a response payload.
 */
function getOverviewCards(value: unknown): OverviewCard[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const cards = Reflect.get(value, "postureCards");
  if (!Array.isArray(cards)) {
    return [];
  }

  const parsed = cards.map((card) => {
    if (!card || typeof card !== "object") {
      return null;
    }

    const label = getOptionalString(card, "label");
    const valueText = getOptionalString(card, "value");
    const note = getOptionalString(card, "note");
    const source = getOptionalString(card, "source");
    const action = getOptionalString(card, "action");
    const lastUpdated = getOptionalString(card, "lastUpdated");

    if (!label || !valueText || !note || !source || !action) {
      return null;
    }

    const base: OverviewCard = {
      label,
      value: valueText,
      note,
      source,
      action,
    };

    return lastUpdated ? { ...base, lastUpdated } : base;
  });

  return parsed.filter((card): card is OverviewCard => card !== null);
}

/**
 * Extract a string property from unknown objects.
 */
function getOptionalString(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const property = Reflect.get(value, key);
  return typeof property === "string" ? property : undefined;
}

/**
 * Extract a string array from unknown objects.
 */
function getStringArray(value: unknown, key: string): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const property = Reflect.get(value, key);
  return Array.isArray(property) &&
    property.every((item) => typeof item === "string")
    ? property
    : [];
}

/**
 * Normalize errors for logging.
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  const message =
    error && typeof error === "object"
      ? Reflect.get(error, "message")
      : undefined;

  return typeof message === "string" ? message : "Unknown error";
}
