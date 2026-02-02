"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUp } from "lucide-react";
import { useRef, useEffect, useState, useCallback } from "react";

import { cn } from "@/lib/utils";

import { ChatMessage } from "./chat-message";

const suggestedPrompts = [
  "What is the current status of all my connectors?",
  "Show me all DLP rules and their trigger counts",
  "Give me an overview of my Chrome Enterprise fleet",
  "What are the recent critical events?",
];

type ChatConsoleProps = {
  initialPrompt?: string;
  className?: string;
};

export function ChatConsole({ initialPrompt, className }: ChatConsoleProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastPromptRef = useRef<string | undefined>(undefined);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    if (
      initialPrompt &&
      initialPrompt !== lastPromptRef.current &&
      !isLoading
    ) {
      lastPromptRef.current = initialPrompt;
      sendMessage({ text: initialPrompt });
    }
  }, [initialPrompt, isLoading, sendMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const submitInput = useCallback(() => {
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  }, [input, isLoading, sendMessage]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      submitInput();
    },
    [submitInput]
  );

  const handlePromptClick = useCallback(
    (prompt: string) => {
      if (isLoading) return;
      sendMessage({ text: prompt });
    },
    [isLoading, sendMessage]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitInput();
      }
    },
    [submitInput]
  );

  const handleAction = useCallback(
    (command: string) => {
      if (isLoading) return;
      sendMessage({ text: command });
    },
    [isLoading, sendMessage]
  );

  return (
    <div className={cn("flex h-full flex-col bg-sidebar", className)}>
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col justify-center px-8 py-16">
            <div className="mb-10">
              <h2 className="text-2xl font-semibold text-foreground">
                CEP Assistant
              </h2>
              <p className="mt-3 text-base text-muted-foreground">
                Ask about your Chrome Enterprise deployment, diagnose issues, or
                make changes.
              </p>
            </div>
            <div className="space-y-2">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handlePromptClick(prompt)}
                  disabled={isLoading}
                  className={cn(
                    "w-full rounded-xl px-5 py-4 text-left",
                    "border border-white/10 bg-white/[0.04] backdrop-blur-xl",
                    "text-base text-foreground",
                    "transition-all duration-200",
                    "hover:border-white/15 hover:bg-white/[0.08]",
                    "disabled:opacity-50"
                  )}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-8 py-8">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onAction={handleAction}
              />
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex items-center gap-3 py-8">
                <span className="h-2 w-2 animate-pulse rounded-full bg-(--color-status-info)" />
                <span className="text-base text-muted-foreground">
                  Thinking...
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border p-6">
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask something..."
            disabled={isLoading}
            rows={1}
            className={cn(
              "w-full resize-none rounded-xl px-5 py-4 pr-14",
              "border border-white/10 bg-white/[0.04] backdrop-blur-xl",
              "text-base text-foreground",
              "placeholder:text-muted-foreground",
              "transition-all duration-200",
              "focus:border-white/20 focus:bg-white/[0.06] focus:outline-none",
              "disabled:opacity-50"
            )}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2",
              "flex h-9 w-9 items-center justify-center rounded-lg",
              "bg-primary text-primary-foreground",
              "transition-all duration-150",
              "hover:bg-primary/90",
              "disabled:opacity-30"
            )}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
