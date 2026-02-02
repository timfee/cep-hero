"use client";

import type { UIMessage } from "ai";

import { getToolName, isToolUIPart } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

import { ToolOutput } from "./tool-outputs";

type ChatMessageProps = {
  message: UIMessage;
  onAction?: (command: string) => void;
};

type ToolPart = {
  state: string;
  output?: unknown;
};

export function ChatMessage({ message, onAction }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("py-5", isUser && "flex justify-end")}>
      <div className={cn("max-w-[90%]", isUser && "text-right")}>
        {message.parts.map((part, index) => {
          if (part.type === "text" && part.text) {
            return (
              <div
                key={index}
                className={cn(
                  "text-base leading-relaxed",
                  isUser
                    ? "inline-block rounded-2xl bg-foreground px-5 py-3 text-background"
                    : "text-foreground"
                )}
              >
                {isUser ? (
                  part.text
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => (
                        <p className="mb-3 last:mb-0">{children}</p>
                      ),
                      ul: ({ children }) => (
                        <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => <li>{children}</li>,
                      strong: ({ children }) => (
                        <strong className="font-semibold">{children}</strong>
                      ),
                      code: ({ children }) => (
                        <code className="rounded bg-accent px-1.5 py-0.5 font-mono text-sm">
                          {children}
                        </code>
                      ),
                      pre: ({ children }) => (
                        <pre className="my-3 overflow-x-auto rounded-lg bg-accent p-4 text-sm">
                          {children}
                        </pre>
                      ),
                      h1: ({ children }) => (
                        <h1 className="mb-3 mt-5 text-xl font-semibold first:mt-0">
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="mb-2 mt-4 text-lg font-semibold first:mt-0">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="mb-2 mt-3 font-semibold first:mt-0">
                          {children}
                        </h3>
                      ),
                      table: ({ children }) => (
                        <div className="my-3 overflow-x-auto">
                          <table className="w-full border-collapse text-sm">
                            {children}
                          </table>
                        </div>
                      ),
                      thead: ({ children }) => (
                        <thead className="border-b border-border">
                          {children}
                        </thead>
                      ),
                      th: ({ children }) => (
                        <th className="px-3 py-2 text-left font-semibold">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="border-b border-border/50 px-3 py-2">
                          {children}
                        </td>
                      ),
                    }}
                  >
                    {part.text}
                  </ReactMarkdown>
                )}
              </div>
            );
          }

          if (isToolUIPart(part)) {
            const toolName = getToolName(part);
            const toolPart = part as ToolPart;
            return (
              <div key={index} className="mt-3">
                <ToolOutput
                  toolName={toolName}
                  state={toolPart.state}
                  output={
                    toolPart.state === "output-available"
                      ? toolPart.output
                      : undefined
                  }
                  onAction={onAction}
                />
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
