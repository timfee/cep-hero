"use client";

import { UIMessage } from "ai";
import { motion } from "framer-motion";
import { User, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

import type { AssistantMessageWithEvidence } from "./types";

import { EvidenceDrawer } from "./EvidenceDrawer";
import { EventsTable, RuleCard, EnrollmentToken } from "./ToolUI";

const HIDE_TOOL_OUTPUTS = new Set<string>(["searchKnowledge"]);

type ToolPart = {
  type: string;
  state?: string;
  output?: unknown;
  toolName?: string;
};

type ToolResult = {
  toolName: string;
  result: unknown;
};

type DlpRule = {
  id?: string;
  displayName?: string;
  resourceName?: string;
  description?: string;
  consoleUrl?: string;
};

type HelpHit = {
  id?: string | number;
  metadata?: { title?: string; url?: string };
};

/**
 * Extract assistant metadata when available.
 */
function asAssistantWithEvidence(
  message: UIMessage
): AssistantMessageWithEvidence | null {
  if (message.role !== "assistant") {
    return null;
  }

  const metadata = message.metadata;
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  return { ...message, metadata };
}

export function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex w-full gap-4 py-6",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border shadow-sm",
          isUser
            ? "border-zinc-700 bg-zinc-800 text-zinc-400"
            : "border-blue-500/20 bg-blue-600/10 text-blue-400"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
      </div>

      {/* Content */}
      <div className={cn("flex flex-1 flex-col gap-4", isUser && "items-end")}>
        <div
          className={cn(
            "relative max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm",
            isUser ? "bg-zinc-800 text-zinc-100 rounded-tr-sm" : "text-zinc-300"
          )}
        >
          {/* Render message parts */}
          {message.parts.map((part, index) => {
            if (part.type === "text") {
              return (
                <div
                  key={index}
                  className="prose prose-invert prose-p:leading-relaxed prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800"
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {part.text}
                  </ReactMarkdown>
                </div>
              );
            }
            return null;
          })}
        </div>

        {/* Evidence & tool outputs */}
        {(() => {
          const assistant = asAssistantWithEvidence(message);
          const ev = assistant?.metadata?.evidence;

          if (assistant && ev) {
            return (
              <div className="w-full max-w-3xl">
                <EvidenceDrawer
                  planSteps={ev.planSteps}
                  hypotheses={ev.hypotheses}
                  nextSteps={ev.nextSteps}
                  missingQuestions={ev.missingQuestions}
                  evidence={ev.evidence}
                />
              </div>
            );
          }
          return null;
        })()}

        {message.parts.map((part, index) => {
          const toolName = getToolName(part);
          if (!toolName) {
            return null;
          }

          if (HIDE_TOOL_OUTPUTS.has(toolName)) {
            return null;
          }

          const output = getToolOutput(part);

          return (
            <div key={index} className="w-full max-w-3xl">
              {output !== null ? (
                <ToolResultRenderer tool={{ toolName, result: output }} />
              ) : (
                <div className="flex items-center gap-2 text-xs text-zinc-500 animate-pulse">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  Working on {toolName}…
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

/**
 * Render tool results as UI blocks.
 */
function ToolResultRenderer({ tool }: { tool: ToolResult }) {
  const result = tool.result;

  if (tool.toolName === "getChromeEvents") {
    return <EventsTable events={getEvents(result)} />;
  }

  if (tool.toolName === "listDLPRules") {
    const rules = getDlpRules(result);
    const hits = getHelpHits(result);
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          {rules.map((rule, i) => (
            <RuleCard key={i} rule={rule} />
          ))}
        </div>
        {hits.length > 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-xs text-zinc-400">
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              Policy References
            </div>
            <ul className="mt-3 space-y-2">
              {hits.map((hit) => (
                <li
                  key={String(hit.id ?? "hit")}
                  className="flex flex-col gap-1"
                >
                  <span className="text-zinc-200">
                    {hit.metadata?.title ?? hit.id}
                  </span>
                  {hit.metadata?.url ? (
                    <a
                      href={hit.metadata.url}
                      target="_blank"
                      rel="noopener"
                      className="text-blue-400 hover:text-blue-300"
                    >
                      {hit.metadata.url}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  if (tool.toolName === "enrollBrowser") {
    const token = getOptionalString(result, "token");
    return token ? <EnrollmentToken token={token} /> : null;
  }

  return null;
}

/**
 * Extract tool name from a tool part.
 */
function getToolName(part: unknown): string | null {
  if (!isToolPart(part)) {
    return null;
  }

  if (part.type === "dynamic-tool") {
    return typeof part.toolName === "string" ? part.toolName : null;
  }

  return part.type.startsWith("tool-") ? part.type.replace("tool-", "") : null;
}

/**
 * Extract output from a tool part when available.
 */
function getToolOutput(part: unknown): unknown | null {
  if (!isToolPart(part)) {
    return null;
  }

  if (part.state !== "output-available") {
    return null;
  }

  return "output" in part ? (part.output ?? null) : null;
}

/**
 * Guard for tool part shape.
 */
function isToolPart(part: unknown): part is ToolPart {
  if (!part || typeof part !== "object") {
    return false;
  }

  const type = Reflect.get(part, "type");
  return typeof type === "string";
}

/**
 * Pull Chrome events from tool output.
 */
function getEvents(
  result: unknown
): Parameters<typeof EventsTable>[0]["events"] {
  if (!result || typeof result !== "object") {
    return [];
  }

  const events = Reflect.get(result, "events");
  return Array.isArray(events) ? events : [];
}

/**
 * Pull DLP rules from tool output.
 */
function getDlpRules(result: unknown): DlpRule[] {
  if (!result || typeof result !== "object") {
    return [];
  }

  const rules = Reflect.get(result, "rules");
  if (!Array.isArray(rules)) {
    return [];
  }

  const parsed: DlpRule[] = [];

  for (const rule of rules) {
    if (!rule || typeof rule !== "object") {
      continue;
    }

    parsed.push({
      id: getOptionalString(rule, "id"),
      displayName: getOptionalString(rule, "displayName"),
      resourceName: getOptionalString(rule, "resourceName"),
      description: getOptionalString(rule, "description"),
      consoleUrl: getOptionalString(rule, "consoleUrl"),
    });
  }

  return parsed;
}

/**
 * Pull help hits from tool output.
 */
function getHelpHits(result: unknown): HelpHit[] {
  if (!result || typeof result !== "object") {
    return [];
  }

  const help = Reflect.get(result, "help");
  if (!help || typeof help !== "object") {
    return [];
  }

  const hits = Reflect.get(help, "hits");
  return Array.isArray(hits) ? hits : [];
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
