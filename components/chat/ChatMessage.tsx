"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { Sparkles, User } from "lucide-react";
import type { UIMessage } from "ai";

import { Message, MessageContent } from "@/components/ai-elements/message";
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements/reasoning";
import { StreamingBlocks } from "@/components/ai-elements/streaming-text";
import { HypothesesList } from "@/components/ai-elements/hypothesis";
import { EvidencePanel } from "@/components/ai-elements/evidence";
import { NextStepsPanel } from "@/components/ai-elements/next-steps";
import { QuestionsPanel } from "@/components/ai-elements/questions";
import { ActionButtons, type ActionItem } from "@/components/ai-elements/action-buttons";
import { ConnectorAlert } from "@/components/ai-elements/connector-alert";
import type {
  Hypothesis,
  MissingQuestion,
  EvidencePayload,
  ConnectorAnalysis,
} from "@/types/chat";

// Metadata shape from the API
export interface MessageEvidence {
  planSteps?: string[];
  hypotheses?: Hypothesis[];
  nextSteps?: string[];
  missingQuestions?: MissingQuestion[];
  evidence?: EvidencePayload;
  connectorAnalysis?: ConnectorAnalysis;
}

export interface ChatMessageProps {
  message: UIMessage;
  isStreaming?: boolean;
  isLast?: boolean;
  onAction?: (command: string) => void;
}

/**
 * Renders a single chat message with proper part handling:
 * - User messages: simple text
 * - Assistant messages: streaming text, reasoning (collapsible inline), structured data
 */
export function ChatMessage({
  message,
  isStreaming = false,
  isLast = false,
  onAction,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const metadata = message.metadata as Record<string, unknown> | undefined;
  const actions = metadata?.actions as ActionItem[] | undefined;
  const evidence = metadata?.evidence as MessageEvidence | undefined;

  // Extract text content from message parts
  const textParts = message.parts.filter(
    (p): p is { type: "text"; text: string } => p.type === "text"
  );
  const reasoningParts = message.parts.filter(
    (p): p is { type: "reasoning"; reasoning: string } => p.type === "reasoning"
  );

  // Get the main text and reasoning content
  const mainText = textParts.map((p) => p.text).join("\n");
  const reasoningText = reasoningParts.map((p) => p.reasoning).join("\n");

  // Show streaming indicator only for last assistant message
  const showStreamingCursor = isStreaming && isLast && !isUser;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Message from={isUser ? "user" : "assistant"}>
        {/* Avatar and role label */}
        <div className="flex items-center gap-2">
          <motion.div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
              isUser
                ? "border-border bg-muted text-muted-foreground"
                : "border-primary/20 bg-primary/10 text-primary"
            )}
            aria-hidden="true"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            {isUser ? (
              <User className="h-4 w-4" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </motion.div>
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {isUser ? "You" : "Assistant"}
          </span>
        </div>

        {/* Message content area */}
        <div className="ml-10 space-y-3">
          {/* Inline reasoning - shown before text, auto-collapses */}
          {!isUser && reasoningText && (
            <Reasoning
              isStreaming={showStreamingCursor}
              defaultOpen={showStreamingCursor}
            >
              <ReasoningTrigger />
              <ReasoningContent>{reasoningText}</ReasoningContent>
            </Reasoning>
          )}

          {/* Main text content */}
          <MessageContent className="max-w-none">
            <StreamingBlocks text={mainText} isStreaming={showStreamingCursor} />
          </MessageContent>

          {/* Structured data for assistant messages */}
          {!isUser && evidence && (
            <div className="space-y-3">
              {/* Connector alert at top if flagged */}
              {evidence.connectorAnalysis && (
                <ConnectorAlert analysis={evidence.connectorAnalysis} />
              )}

              {/* Hypotheses - shown prominently */}
              {evidence.hypotheses && evidence.hypotheses.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Hypotheses
                  </p>
                  <HypothesesList hypotheses={evidence.hypotheses} />
                </div>
              )}

              {/* Evidence panel - collapsible */}
              {evidence.evidence && <EvidencePanel evidence={evidence.evidence} />}

              {/* Questions panel - collapsible, default open */}
              {evidence.missingQuestions && (
                <QuestionsPanel
                  questions={evidence.missingQuestions}
                  defaultOpen={true}
                />
              )}

              {/* Next steps - collapsible, default open */}
              {evidence.nextSteps && (
                <NextStepsPanel
                  steps={evidence.nextSteps}
                  defaultOpen={true}
                  onRunStep={onAction}
                />
              )}
            </div>
          )}

          {/* Action buttons */}
          {!isUser && actions && actions.length > 0 && onAction && (
            <ActionButtons actions={actions} onAction={onAction} />
          )}
        </div>
      </Message>
    </motion.div>
  );
}
