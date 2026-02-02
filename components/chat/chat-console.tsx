"use client";

import { useChat } from "@ai-sdk/react";
import { AnimatePresence } from "motion/react";
import { SendHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ChatMessage } from "./chat-message";

export function ChatConsole() {
  const { messages, sendMessage, status } = useChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isStreaming = status === "submitted" || status === "streaming";

  // Auto-scroll on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isStreaming]);

  // Listen for cross-page action dispatches
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { command?: string };
      if (!detail?.command) return;
      void sendMessage({ text: detail.command });
    };
    document.addEventListener("cep-action", handler);
    return () => document.removeEventListener("cep-action", handler);
  }, [sendMessage]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput("");
    await sendMessage({ text: trimmed });
  };

  const handleAction = (command: string) => {
    void sendMessage({ text: command });
  };

  return (
    <div className="flex h-full min-h-[600px] flex-col rounded-lg border border-border bg-card">
      {/* Messages Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
      >
        <AnimatePresence mode="popLayout">
          {/* Empty state */}
          {messages.length === 0 && !isStreaming && (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <div className="mb-3 text-4xl">?</div>
              <h3 className="text-base font-medium text-foreground">
                How can I help?
              </h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Ask about Chrome Enterprise Premium configurations, connector
                issues, or DLP policies.
              </p>
            </div>
          )}

          {/* Messages */}
          {messages.map((message, index) => (
            <ChatMessage
              key={message.id}
              message={message}
              isStreaming={isStreaming}
              isLast={index === messages.length - 1}
              onAction={handleAction}
            />
          ))}

          {/* Streaming placeholder */}
          {isStreaming && messages.length > 0 && status === "submitted" && (
            <ChatMessage
              message={{
                id: "streaming",
                role: "assistant",
                content: "",
                parts: [],
              }}
              isStreaming={true}
              isLast={true}
              onAction={handleAction}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-3 border-t border-border p-4"
      >
        <input
          id="chat-input"
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isStreaming ? "Thinking..." : "Type a message..."}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          disabled={isStreaming}
          aria-label="Message input"
        />
        <Button
          type="submit"
          disabled={isStreaming || !input.trim()}
          size="sm"
          variant="default"
          aria-label="Send message"
        >
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
