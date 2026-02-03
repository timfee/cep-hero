"use client";

import { useChat } from "@ai-sdk/react";
import { createContext, useContext, useMemo, useState } from "react";

interface ChatContextValue {
  messages: ReturnType<typeof useChat>["messages"];
  status: ReturnType<typeof useChat>["status"];
  input: string;
  setInput: (value: string) => void;
  sendMessage: ReturnType<typeof useChat>["sendMessage"];
  stop: ReturnType<typeof useChat>["stop"];
  regenerate: ReturnType<typeof useChat>["regenerate"];
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [input, setInput] = useState("");

  const { messages, status, sendMessage, stop, regenerate } = useChat();

  const value = useMemo<ChatContextValue>(
    () => ({
      messages,
      status,
      input,
      setInput,
      sendMessage,
      stop,
      regenerate,
    }),
    [messages, status, input, sendMessage, stop, regenerate]
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
