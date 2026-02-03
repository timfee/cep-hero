/**
 * Chat context provider for sharing chat state across components.
 * Wraps the AI SDK's useChat hook with React context for app-wide access.
 */

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

/**
 * Provider component that initializes chat state and makes it available to children.
 */
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

/**
 * Hook to access chat context. Throws if used outside ChatProvider.
 */
export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("ChatContext is missing");
  }
  return ctx;
}
