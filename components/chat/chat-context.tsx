/**
 * Chat context provider for sharing chat state across components.
 * Wraps the AI SDK's useChat hook with React context for app-wide access.
 */

"use client";

import { useChat } from "@ai-sdk/react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { useFixtureContext } from "@/lib/fixtures/context";

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
  const { activeFixture, isFixtureMode } = useFixtureContext();

  const {
    messages,
    status,
    sendMessage: originalSendMessage,
    stop,
    regenerate,
  } = useChat();

  // Wrap sendMessage to include fixture headers and data when in demo mode
  const sendMessage = useCallback<typeof originalSendMessage>(
    (message, options) => {
      if (isFixtureMode && activeFixture) {
        return originalSendMessage(message, {
          ...options,
          headers: {
            ...options?.headers,
            "x-eval-test-mode": "1",
          },
          body: {
            ...options?.body,
            fixtures: activeFixture.data,
          },
        });
      }
      return originalSendMessage(message, options);
    },
    [originalSendMessage, isFixtureMode, activeFixture]
  );

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
