"use client";

import { useChat } from "@ai-sdk/react";
import { SendHorizontal, Sparkles, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
} from "@/components/ai-elements/message";
import {
  DashboardPanel,
  DashboardPanelContent,
  DashboardPanelDescription,
  DashboardPanelHeader,
  DashboardPanelTitle,
} from "@/components/ui/dashboard-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Loader } from "@/components/ai-elements/loader";

export function ChatConsole() {
  const { messages, sendMessage, status } = useChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isStreaming = status === "submitted" || status === "streaming";

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

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
        {isStreaming && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader size={14} />
            <span>Thinking...</span>
          </div>
        )}
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
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-sm font-medium text-foreground">
                Start a conversation
              </h3>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Ask about Chrome Enterprise Premium configurations, connector
                issues, or DLP policies.
              </p>
            </div>
          )}

          {messages.map((message) => {
            const isUser = message.role === "user";
            const actions = (message.metadata as Record<string, unknown>)
              ?.actions as
              | Array<{
                  id: string;
                  label?: string;
                  command?: string;
                  primary?: boolean;
                }>
              | undefined;

            return (
              <Message key={message.id} from={isUser ? "user" : "assistant"}>
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                      isUser
                        ? "border-border bg-muted text-muted-foreground"
                        : "border-primary/20 bg-primary/10 text-primary"
                    )}
                    aria-hidden="true"
                  >
                    {isUser ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </div>
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {isUser ? "You" : "Assistant"}
                  </span>
                </div>

                <MessageContent className="ml-10 max-w-none">
                  {message.parts.map((part, idx) => {
                    if (part.type !== "text") return null;
                    return part.text.split(/\n{2,}/).map((block, blockIdx) => (
                      <p
                        key={`${idx}-${blockIdx}`}
                        className="whitespace-pre-wrap text-sm leading-relaxed text-foreground"
                      >
                        {block}
                      </p>
                    ));
                  })}
                </MessageContent>

                {actions && actions.length > 0 && (
                  <MessageActions className="ml-10 mt-2 flex flex-wrap gap-2">
                    {actions.map((action) => (
                      <MessageAction
                        key={action.id}
                        size="sm"
                        variant={action.primary ? "default" : "secondary"}
                        onClick={() => {
                          const cmd =
                            action.command ?? action.label ?? action.id;
                          if (!cmd) return;
                          void sendMessage({ text: cmd });
                        }}
                      >
                        {action.label ?? action.id}
                      </MessageAction>
                    ))}
                  </MessageActions>
                )}
              </Message>
            );
          })}
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
