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
import { Panel } from "@/components/ai-elements/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function ChatConsole() {
  const { messages, sendMessage, status } = useChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

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
    <div className="flex min-h-screen flex-col bg-[#0c0f17] text-zinc-100">
      <header className="flex items-center gap-3 border-b border-white/5 bg-black/70 px-6 py-4 backdrop-blur">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="text-sm font-medium">CEP Assistant</div>
          <div className="text-xs text-zinc-500">Guided fixes with actions</div>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 px-6 py-4">
        <Panel className="flex h-full flex-col bg-zinc-950 text-sm">
          <div
            ref={scrollRef}
            className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
          >
            {messages.map((message) => {
              const isUser = message.role === "user";
              const actions = (message.metadata as any)?.actions as
                | Array<{ id: string; label?: string; command?: string; primary?: boolean }>
                | undefined;

              return (
                <Message key={message.id} from={isUser ? "user" : "assistant"}>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full border shadow-sm",
                        isUser
                          ? "border-zinc-700 bg-zinc-800 text-zinc-300"
                          : "border-blue-500/20 bg-blue-600/10 text-blue-200"
                      )}
                    >
                      {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                    </div>
                    <span className="text-xs uppercase tracking-[0.1em]">
                      {isUser ? "You" : "Assistant"}
                    </span>
                  </div>

                  <MessageContent className="max-w-3xl space-y-2 leading-relaxed">
                    {message.parts.map((part, idx) => {
                      if (part.type !== "text") return null;
                      return part.text
                        .split(/\n{2,}/)
                        .map((block, blockIdx) => (
                          <p
                            key={`${idx}-${blockIdx}`}
                            className="whitespace-pre-wrap text-[15px] leading-7 text-zinc-50"
                          >
                            {block}
                          </p>
                        ));
                    })}
                  </MessageContent>

                  {actions && actions.length > 0 ? (
                    <MessageActions className="mt-1 flex flex-wrap gap-2">
                      {actions.map((action) => (
                        <MessageAction
                          key={action.id}
                          size="sm"
                          variant={action.primary ? "default" : "secondary"}
                          onClick={() => {
                            const cmd = action.command ?? action.label ?? action.id;
                            if (!cmd) return;
                            void sendMessage({ text: cmd });
                          }}
                        >
                          {action.label ?? action.id}
                        </MessageAction>
                      ))}
                    </MessageActions>
                  ) : null}
                </Message>
              );
            })}
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t border-white/5 bg-zinc-900/70 px-4 py-3"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isStreaming ? "Assistant is responding…" : "Ask CEP or trigger an action"}
              className="flex-1 border-white/10 bg-zinc-900/70 text-sm text-zinc-100 placeholder:text-zinc-500"
              disabled={isStreaming}
            />
            <Button type="submit" disabled={isStreaming || !input.trim()} size="icon">
              <SendHorizontal className="h-4 w-4" />
            </Button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
