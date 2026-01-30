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

function asAssistantWithEvidence(
  message: UIMessage
): AssistantMessageWithEvidence | null {
  if (message.role !== "assistant") return null;
  return message as unknown as AssistantMessageWithEvidence;
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
          const isTool =
            part.type.startsWith("tool-") || part.type === "dynamic-tool";

          if (isTool) {
            const toolPart = part as any;
            const toolName =
              toolPart.type === "dynamic-tool"
                ? toolPart.toolName
                : toolPart.type.replace("tool-", "");

            if (HIDE_TOOL_OUTPUTS.has(toolName)) return null;

            return (
              <div key={index} className="w-full max-w-3xl">
                {toolPart.state === "output-available" ? (
                  <ToolResultRenderer
                    tool={{
                      toolName,
                      result: toolPart.output,
                    }}
                  />
                ) : (
                  <div className="flex items-center gap-2 text-xs text-zinc-500 animate-pulse">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    Working on {toolName}…
                  </div>
                )}
              </div>
            );
          }
          return null;
        })}
      </div>
    </motion.div>
  );
}

function ToolResultRenderer({ tool }: { tool: any }) {
  const result = tool.result;

  if (tool.toolName === "getChromeEvents") {
    return <EventsTable events={result.events} />;
  }

  if (tool.toolName === "listDLPRules") {
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          {result.rules?.map((rule: any, i: number) => (
            <RuleCard key={i} rule={rule} />
          ))}
        </div>
        {result.help?.hits?.length ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-xs text-zinc-400">
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              Policy References
            </div>
            <ul className="mt-3 space-y-2">
              {result.help.hits.map((hit: any) => (
                <li key={hit.id} className="flex flex-col gap-1">
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
    return <EnrollmentToken token={result.token} />;
  }

  // Default: keep tool output hidden unless needed
  return null;
}
