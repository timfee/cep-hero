"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { Sparkles, User } from "lucide-react";
import type { Message as AIMessage } from "ai";
import { memo, useState, useEffect } from "react";

import {
  Message,
  MessageContent,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";
import { StreamingText, ThinkingIndicator } from "@/components/ai-elements/streaming-text";
import { DiagnosisCard } from "@/components/ai-elements/diagnosis-card";
import { HypothesesList } from "@/components/ai-elements/hypothesis-card";
import { EvidencePanel } from "@/components/ai-elements/evidence-panel";
import { ConnectorStatus } from "@/components/ai-elements/connector-status";
import { PlanSteps } from "@/components/ai-elements/plan-steps";
import { NextStepsPanel } from "@/components/ai-elements/next-steps-panel";
import { MissingQuestionsList } from "@/components/ai-elements/missing-questions";
import { ActionButtons, type ActionItem } from "@/components/ai-elements/action-buttons";
import type {
  DiagnosisPayload,
  EvidencePayload,
  ConnectorAnalysis,
  Hypothesis,
  MissingQuestion,
  Reference,
} from "@/types/chat";

export interface ChatMessageProps {
  message: AIMessage;
  isStreaming?: boolean;
  isLast?: boolean;
  onAction?: (command: string) => void;
}

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

export const ChatMessage = memo(function ChatMessage({
  message,
  isStreaming = false,
  isLast = false,
  onAction,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const metadata = message.metadata as MessageMetadata | undefined;

  // Extract text and reasoning from message parts
  const textParts = message.parts.filter(
    (p): p is { type: "text"; text: string } => p.type === "text"
  );
  const reasoningParts = message.parts.filter(
    (p): p is { type: "reasoning"; reasoning: string } => p.type === "reasoning"
  );

  const mainText = textParts.map((p) => p.text).join("\n");
  const reasoningText = reasoningParts.map((p) => p.reasoning).join("\n");

  // Show streaming cursor only for last assistant message while streaming
  const showStreamingCursor = isStreaming && isLast && !isUser;

  // Auto-collapse reasoning when new text arrives
  const [reasoningOpen, setReasoningOpen] = useState(showStreamingCursor);
  useEffect(() => {
    if (!isStreaming && reasoningText) {
      setReasoningOpen(false);
    }
  }, [isStreaming, reasoningText]);

  // Extract structured data from metadata
  const evidence = metadata?.evidence;
  const actions = metadata?.actions;

  // Parse diagnosis from text if present
  const diagnosisMatch = mainText.match(/^Diagnosis:\s*(.+?)(?=\n|$)/m);
  const diagnosis = diagnosisMatch?.[1];

  // Get text without diagnosis prefix for cleaner display
  const displayText = diagnosis
    ? mainText.replace(/^Diagnosis:\s*.+?\n?/, "").trim()
    : mainText;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Message from={isUser ? "user" : "assistant"}>
        {/* Avatar and role label */}
        <div className="flex items-center gap-2">
          <motion.div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
              isUser
                ? "border-border bg-muted text-muted-foreground"
                : "border-primary/20 bg-primary/10 text-primary"
            )}
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
          >
            {isUser ? (
              <User className="h-3.5 w-3.5" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
          </motion.div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {isUser ? "You" : "Assistant"}
          </span>
        </div>

        <div className="ml-9 space-y-4">
          {/* Inline reasoning - shown before text, auto-collapses */}
          {!isUser && reasoningText && (
            <Reasoning
              isStreaming={showStreamingCursor}
              open={reasoningOpen}
              onOpenChange={setReasoningOpen}
            >
              <ReasoningTrigger />
              <ReasoningContent>{reasoningText}</ReasoningContent>
            </Reasoning>
          )}

          {/* Streaming indicator when waiting for response */}
          {showStreamingCursor && !mainText && !reasoningText && (
            <ThinkingIndicator message="Analyzing" />
          )}

          {/* Diagnosis card - prominent display */}
          {!isUser && diagnosis && (
            <DiagnosisCard
              diagnosis={diagnosis}
              reference={null}
            />
          )}

          {/* Main text content */}
          {displayText && (
            <MessageContent className="max-w-none">
              <StreamingText text={displayText} isStreaming={showStreamingCursor} />
            </MessageContent>
          )}

          {/* Connector status alert */}
          {!isUser && evidence?.connectorAnalysis?.flag && (
            <ConnectorStatus analysis={evidence.connectorAnalysis} />
          )}

          {/* Plan steps - what the AI checked */}
          {!isUser && evidence?.planSteps && evidence.planSteps.length > 0 && (
            <PlanSteps steps={evidence.planSteps} />
          )}

          {/* Evidence panel */}
          {!isUser && evidence?.evidence && (
            <EvidencePanel evidence={evidence.evidence} />
          )}

          {/* Hypotheses */}
          {!isUser && evidence?.hypotheses && evidence.hypotheses.length > 0 && (
            <HypothesesList hypotheses={evidence.hypotheses} />
          )}

          {/* Missing questions */}
          {!isUser && evidence?.missingQuestions && evidence.missingQuestions.length > 0 && (
            <MissingQuestionsList questions={evidence.missingQuestions} />
          )}

          {/* Next steps */}
          {!isUser && evidence?.nextSteps && evidence.nextSteps.length > 0 && (
            <NextStepsPanel
              steps={evidence.nextSteps}
              onStepClick={onAction}
            />
          )}

          {/* Action buttons */}
          {!isUser && actions && actions.length > 0 && (
            <ActionButtons actions={actions} onAction={onAction} />
          )}
        </div>
      </Message>
    </motion.div>
  );
});
