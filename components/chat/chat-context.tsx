"use client";

import { useChat } from "@ai-sdk/react";
import { createContext, useContext, useMemo, useState } from "react";

import { clientFetch } from "@/lib/http";

type ChatContextValue = {
  messages: ReturnType<typeof useChat>["messages"];
  status: ReturnType<typeof useChat>["status"];
  input: string;
  setInput: (value: string) => void;
  sendMessage: ReturnType<typeof useChat>["sendMessage"];
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [input, setInput] = useState("");

  const { messages, status, sendMessage } = useChat({
    fetch: clientFetch,
  });

  const value = useMemo<ChatContextValue>(
    () => ({ messages, status, input, setInput, sendMessage }),
    [messages, status, input, sendMessage]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("ChatContext is missing");
  }
  return ctx;
}
