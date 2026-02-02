"use client";

import { SendHorizontal, HelpCircle, Loader2 } from "lucide-react";
import { useMemo, memo, useCallback } from "react";

import type {
  EvidencePayload,
  ConnectorAnalysis,
  Hypothesis,
  MissingQuestion,
} from "@/types/chat";

import {
  ActionButtons,
  type ActionItem,
} from "@/components/ai-elements/action-buttons";
import { ConnectorStatus } from "@/components/ai-elements/connector-status";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { EvidencePanel } from "@/components/ai-elements/evidence-panel";
// Domain-specific components
import { HypothesesList } from "@/components/ai-elements/hypothesis-card";
import { Loader, ThinkingIndicator } from "@/components/ai-elements/loader";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { MissingQuestionsList } from "@/components/ai-elements/missing-questions";
import { NextStepsPanel } from "@/components/ai-elements/next-steps-panel";
import { PlanSteps } from "@/components/ai-elements/plan-steps";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";
import { Button } from "@/components/ui/button";
import { useChatContext } from "@/components/chat/chat-context";
import { cn } from "@/lib/utils";

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
  const { messages, sendMessage, status, input, setInput } = useChatContext();

  const isStreaming = status === "submitted" || status === "streaming";
  const isSubmitting = status === "submitted";

  const handleSubmit = useCallback((message: PromptInputMessage) => {
    const trimmed = message.text?.trim();
    if (!trimmed) return;
    setInput("");
    void sendMessage({ text: trimmed });
  }, [setInput, sendMessage]);

  const handleAction = useCallback((command: string) => {
    void sendMessage({ text: command });
  }, [sendMessage]);

  // Stable message keys - use ID if available, otherwise index-based
  const memoizedMessages = useMemo(() => messages, [messages]);

  return (
    <div className="flex h-full min-h-[600px] flex-col rounded-lg border border-border bg-card lg:min-h-[700px]">
      {/* Conversation with auto-scroll */}
      <Conversation className="flex-1">
        <ConversationContent className="p-0 lg:p-1">
          {/* Empty state */}
          {memoizedMessages.length === 0 && !isStreaming && (
            <ConversationEmptyState
              icon={<HelpCircle className="h-8 w-8" />}
              title="How can I help?"
              description="Ask about Chrome Enterprise Premium configurations, connector issues, or DLP policies."
            />
          )}

          {/* Messages */}
          {memoizedMessages.map((message, index) => {
            const isUser = message.role === "user";
            const isLast = index === memoizedMessages.length - 1;
            const showStreamingCursor = isStreaming && isLast && !isUser;
            const metadata = message.metadata as MessageMetadata | undefined;
            // Use stable keys - prefer message.id, fallback to content hash
            const messageKey = message.id || `msg-${index}-${message.role}`;

            // Extract parts with stable references
            const textParts = message.parts.filter((p) => p.type === "text");
            const reasoningParts = message.parts.filter(
              (p) => p.type === "reasoning"
            );

            const mainText = textParts
              .map((p) =>
                "text" in p && typeof p.text === "string" ? p.text : ""
              )
              .filter(Boolean)
              .join("\n");
            const reasoningText = reasoningParts
              .map((p) =>
                "reasoning" in p && typeof p.reasoning === "string"
                  ? p.reasoning
                  : ""
              )
              .filter(Boolean)
              .join("\n");
            const evidence = metadata?.evidence;
            const actions = metadata?.actions;

            return (
              <Message
                key={messageKey}
                from={message.role}
                className={cn(
                  "px-4 py-4 lg:px-6 lg:py-5",
                  isUser ? "bg-transparent" : "bg-muted/30",
                  // Prevent layout shift during streaming
                  "will-change-contents"
                )}
              >
                {/* Role label */}
                <div className="text-xs font-medium text-muted-foreground">
                  {isUser ? "You" : "Assistant"}
                </div>

                <MessageContent className="space-y-3 lg:space-y-4">
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

                  {!isUser &&
                    evidence?.planSteps &&
                    evidence.planSteps.length > 0 && (
                      <PlanSteps steps={evidence.planSteps} />
                    )}

                  {!isUser && evidence?.evidence && (
                    <EvidencePanel evidence={evidence.evidence} />
                  )}

                  {!isUser &&
                    evidence?.hypotheses &&
                    evidence.hypotheses.length > 0 && (
                      <HypothesesList hypotheses={evidence.hypotheses} />
                    )}

                  {!isUser &&
                    evidence?.missingQuestions &&
                    evidence.missingQuestions.length > 0 && (
                      <MissingQuestionsList
                        questions={evidence.missingQuestions}
                      />
                    )}

                  {!isUser &&
                    evidence?.nextSteps &&
                    evidence.nextSteps.length > 0 && (
                      <NextStepsPanel
                        steps={evidence.nextSteps}
                        onStepClick={handleAction}
                        disabled={isStreaming}
                      />
                    )}

                  {!isUser && actions && actions.length > 0 && (
                    <ActionButtons 
                      actions={actions} 
                      onAction={handleAction}
                      disabled={isStreaming}
                    />
                  )}
                </MessageContent>
              </Message>
            );
          })}

          {/* Streaming loader */}
          {status === "submitted" && (
            <Loader
              className="mx-4 my-4 text-muted-foreground"
              variant="dots"
            />
          )}
        </ConversationContent>

        <ConversationScrollButton />
      </Conversation>

      {/* Input using PromptInput */}
      <PromptInput
        onSubmit={handleSubmit}
        className="border-t border-border p-4 lg:p-5"
      >
        <div className="flex items-center gap-3">
          <PromptInputTextarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isSubmitting ? "Sending..." : isStreaming ? "Waiting for response..." : "Type a message..."}
            disabled={isStreaming}
            aria-disabled={isStreaming}
            className={cn(
              "min-h-0 flex-1 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 lg:text-base",
              isStreaming && "opacity-60"
            )}
            rows={1}
          />
          <PromptInputSubmit asChild>
            <Button
              type="submit"
              disabled={isStreaming || !input.trim()}
              size="sm"
              variant="default"
              aria-label={isSubmitting ? "Sending message" : "Send message"}
              aria-busy={isSubmitting}
              className={cn(
                "cursor-pointer transition-all",
                isStreaming && "cursor-not-allowed opacity-50"
              )}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SendHorizontal className="h-4 w-4" />
              )}
            </Button>
          </PromptInputSubmit>
        </div>
      </PromptInput>
    </div>
  );
}
