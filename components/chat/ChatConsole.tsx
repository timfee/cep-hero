"use client";

import { useChat } from "@ai-sdk/react";
import { motion, AnimatePresence } from "motion/react";
import { SendHorizontal, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  DashboardPanel,
  DashboardPanelContent,
  DashboardPanelDescription,
  DashboardPanelHeader,
  DashboardPanelTitle,
} from "@/components/ui/dashboard-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMessage } from "./ChatMessage";
import { StreamingIndicator } from "./StreamingIndicator";

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

  // Listen for cross-page action dispatches (e.g., overview cards)
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
    <DashboardPanel className="flex h-full min-h-[500px] flex-col">
      {/* Header */}
      <DashboardPanelHeader className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"
          aria-hidden="true"
        >
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <DashboardPanelTitle>CEP Assistant</DashboardPanelTitle>
          <DashboardPanelDescription>
            Guided fixes with actions
          </DashboardPanelDescription>
        </div>
      </DashboardPanelHeader>

      {/* Messages Area */}
      <DashboardPanelContent className="flex-1 overflow-hidden p-0">
        <div
          ref={scrollRef}
          className="h-full space-y-4 overflow-y-auto px-4 py-4"
          role="log"
          aria-label="Chat messages"
          aria-live="polite"
        >
          <AnimatePresence mode="popLayout">
            {/* Empty state */}
            {messages.length === 0 && !isStreaming && (
              <motion.div
                key="empty-state"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex h-full flex-col items-center justify-center text-center"
              >
                <motion.div
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <Sparkles className="h-6 w-6 text-primary" />
                </motion.div>
                <h3 className="text-sm font-medium text-foreground">
                  Start a conversation
                </h3>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Ask about Chrome Enterprise Premium configurations, connector
                  issues, or DLP policies.
                </p>
              </motion.div>
            )}

            {/* Message list */}
            {messages.map((message, idx) => (
              <ChatMessage
                key={message.id}
                message={message}
                isStreaming={isStreaming}
                isLast={idx === messages.length - 1}
                onAction={handleAction}
              />
            ))}

            {/* Streaming indicator - shows inline when waiting for response */}
            {status === "submitted" && (
              <StreamingIndicator key="streaming" />
            )}
          </AnimatePresence>
        </div>
      </DashboardPanelContent>

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-border bg-muted/50 px-4 py-3"
      >
        <label htmlFor="chat-input" className="sr-only">
          Message input
        </label>
        <Input
          id="chat-input"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isStreaming
              ? "Assistant is responding..."
              : "Ask CEP or trigger an action"
          }
          className="flex-1"
          disabled={isStreaming}
          aria-describedby={isStreaming ? "streaming-status" : undefined}
        />
        {isStreaming && (
          <span id="streaming-status" className="sr-only">
            Assistant is currently responding. Please wait.
          </span>
        )}
        <Button
          type="submit"
          disabled={isStreaming || !input.trim()}
          size="icon"
          aria-label="Send message"
        >
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </form>
    </DashboardPanel>
  );
}
