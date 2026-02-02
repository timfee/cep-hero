"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useState } from "react";
import { SendHorizontal, HelpCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";
import { Loader, ThinkingIndicator } from "@/components/ai-elements/loader";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";

// Domain-specific components
import { HypothesesList } from "@/components/ai-elements/hypothesis-card";
import { EvidencePanel } from "@/components/ai-elements/evidence-panel";
import { ConnectorStatus } from "@/components/ai-elements/connector-status";
import { PlanSteps } from "@/components/ai-elements/plan-steps";
import { NextStepsPanel } from "@/components/ai-elements/next-steps-panel";
import { MissingQuestionsList } from "@/components/ai-elements/missing-questions";
import { ActionButtons, type ActionItem } from "@/components/ai-elements/action-buttons";
import type {
  EvidencePayload,
  ConnectorAnalysis,
  Hypothesis,
  MissingQuestion,
} from "@/types/chat";

interface MessageMetadata {
  evidence?: {
    planSteps?: string[];
    hypotheses?: Hypothesis[];
    nextSteps?: string[];
    missingQuestions?: MissingQuestion[];
    evidence?: EvidencePayload;
    connectorAnalysis?: ConnectorAnalysis;
  };
  actions?: ActionItem[];
}

export function ChatConsole() {
  const { messages, sendMessage, status } = useChat();
  const [input, setInput] = useState("");

  const isStreaming = status === "submitted" || status === "streaming";

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

  const handleSubmit = (message: PromptInputMessage) => {
    const trimmed = message.text?.trim();
    if (!trimmed) return;
    setInput("");
    void sendMessage({ text: trimmed });
  };

  const handleAction = (command: string) => {
    void sendMessage({ text: command });
  };

  return (
    <div className="flex h-full min-h-[600px] flex-col rounded-lg border border-border bg-card">
      {/* Conversation with auto-scroll */}
      <Conversation className="flex-1">
        <ConversationContent className="p-0">
          {/* Empty state */}
          {messages.length === 0 && !isStreaming && (
            <ConversationEmptyState
              icon={<HelpCircle className="h-8 w-8" />}
              title="How can I help?"
              description="Ask about Chrome Enterprise Premium configurations, connector issues, or DLP policies."
            />
          )}

          {/* Messages */}
          {messages.map((message, index) => {
            const isUser = message.role === "user";
            const isLast = index === messages.length - 1;
            const showStreamingCursor = isStreaming && isLast && !isUser;
            const metadata = message.metadata as MessageMetadata | undefined;

            // Extract parts
            const textParts = message.parts.filter(
              (p): p is { type: "text"; text: string } => p.type === "text"
            );
            const reasoningParts = message.parts.filter(
              (p): p is { type: "reasoning"; reasoning: string } =>
                p.type === "reasoning"
            );

            const mainText = textParts.map((p) => p.text).join("\n");
            const reasoningText = reasoningParts.map((p) => p.reasoning).join("\n");
            const evidence = metadata?.evidence;
            const actions = metadata?.actions;

            return (
              <Message
                key={message.id}
                from={message.role}
                className={isUser ? "bg-transparent px-4 py-4" : "bg-muted/30 px-4 py-4"}
              >
                {/* Role label */}
                <div className="text-xs font-medium text-muted-foreground">
                  {isUser ? "You" : "Assistant"}
                </div>

                <MessageContent className="space-y-3">
                  {/* Reasoning */}
                  {!isUser && reasoningText && (
                    <Reasoning isStreaming={showStreamingCursor} defaultOpen>
                      <ReasoningTrigger />
                      <ReasoningContent>{reasoningText}</ReasoningContent>
                    </Reasoning>
                  )}

                  {/* Thinking indicator */}
                  {showStreamingCursor && !mainText && !reasoningText && (
                    <ThinkingIndicator message="Thinking" />
                  )}

                  {/* Main text with streaming markdown support */}
                  {mainText && <MessageResponse>{mainText}</MessageResponse>}

                  {/* Domain-specific structured data */}
                  {!isUser && evidence?.connectorAnalysis?.flag && (
                    <ConnectorStatus analysis={evidence.connectorAnalysis} />
                  )}

                  {!isUser && evidence?.planSteps && evidence.planSteps.length > 0 && (
                    <PlanSteps steps={evidence.planSteps} />
                  )}

                  {!isUser && evidence?.evidence && (
                    <EvidencePanel evidence={evidence.evidence} />
                  )}

                  {!isUser && evidence?.hypotheses && evidence.hypotheses.length > 0 && (
                    <HypothesesList hypotheses={evidence.hypotheses} />
                  )}

                  {!isUser && evidence?.missingQuestions && evidence.missingQuestions.length > 0 && (
                    <MissingQuestionsList questions={evidence.missingQuestions} />
                  )}

                  {!isUser && evidence?.nextSteps && evidence.nextSteps.length > 0 && (
                    <NextStepsPanel steps={evidence.nextSteps} onStepClick={handleAction} />
                  )}

                  {!isUser && actions && actions.length > 0 && (
                    <ActionButtons actions={actions} onAction={handleAction} />
                  )}
                </MessageContent>
              </Message>
            );
          })}

          {/* Streaming loader */}
          {status === "submitted" && <Loader className="mx-4 my-4 text-muted-foreground" variant="dots" />}
        </ConversationContent>

        <ConversationScrollButton />
      </Conversation>

      {/* Input using PromptInput */}
      <PromptInput
        onSubmit={handleSubmit}
        className="border-t border-border p-4"
      >
        <div className="flex items-center gap-3">
          <PromptInputTextarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isStreaming ? "Thinking..." : "Type a message..."}
            disabled={isStreaming}
            className="min-h-0 flex-1 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
            rows={1}
          />
          <PromptInputSubmit asChild>
            <Button
              type="submit"
              disabled={isStreaming || !input.trim()}
              size="sm"
              variant="default"
              aria-label="Send message"
            >
              <SendHorizontal className="h-4 w-4" />
            </Button>
          </PromptInputSubmit>
        </div>
      </PromptInput>
    </div>
  );
}
