import { SendHorizontal, HelpCircle, Loader2, RefreshCcwIcon, CopyIcon } from "lucide-react";
import { useMemo, useCallback } from "react";
import { getToolName, isToolUIPart } from "ai";

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
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message";
import { MissingQuestionsList } from "@/components/ai-elements/missing-questions";
import { NextStepsPanel } from "@/components/ai-elements/next-steps-panel";
import { PlanSteps } from "@/components/ai-elements/plan-steps";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputFooter,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { useChatContext } from "@/components/chat/chat-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OrgUnitsList } from "./org-units-list";

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
  const { messages, sendMessage, status, input, setInput, stop, regenerate } =
    useChatContext();

  const isStreaming = status === "submitted" || status === "streaming";

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      const trimmed = message.text?.trim();
      if (!trimmed) return;
      void sendMessage({ text: trimmed });
    },
    [sendMessage]
  );

  const handleAction = useCallback(
    (command: string) => {
      void sendMessage({ text: command });
    },
    [sendMessage]
  );

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card">
      {/* Conversation with auto-scroll */}
      <Conversation className="flex-1">
        <ConversationContent className="p-4 lg:p-6">
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
            const metadata = message.metadata as MessageMetadata | undefined;
            const evidence = metadata?.evidence;
            const actions = metadata?.actions;

            return (
              <div key={message.id || index} className="space-y-4">
                {message.parts.map((part, i) => {
                  const partKey = `${message.id || index}-${i}`;

                  if (part.type === "reasoning") {
                    return (
                      <Reasoning
                        key={partKey}
                        isStreaming={isStreaming && isLast}
                        defaultOpen
                      >
                        <ReasoningTrigger />
                        <ReasoningContent>{part.text}</ReasoningContent>
                      </Reasoning>
                    );
                  }

                  if (part.type === "text") {
                    return (
                      <Message
                        key={partKey}
                        from={message.role}
                        className={cn(
                          isUser ? "bg-transparent" : "bg-muted p-4 lg:p-6"
                        )}
                      >
                        <MessageContent>
                          <MessageResponse>{part.text}</MessageResponse>
                        </MessageContent>
                        {!isUser && (
                          <MessageActions>
                            <MessageAction
                              onClick={() => regenerate()}
                              tooltip="Regenerate"
                            >
                              <RefreshCcwIcon className="size-4" />
                            </MessageAction>
                            <MessageAction
                              onClick={() =>
                                navigator.clipboard.writeText(part.text)
                              }
                              tooltip="Copy"
                            >
                              <CopyIcon className="size-4" />
                            </MessageAction>
                          </MessageActions>
                        )}
                      </Message>
                    );
                  }

                  if (isToolUIPart(part)) {
                    const toolName = getToolName(part);
                    const toolPart = part as any; // Cast to access state/input/output safely if needed

                    // 1. Suggest Actions -> Action Buttons
                    if (
                      toolName === "suggestActions" &&
                      toolPart.state === "output-available"
                    ) {
                      const actions = (toolPart.input as { actions: string[] })
                        ?.actions;
                      if (actions && actions.length > 0) {
                        return (
                          <div key={partKey} className="pl-4 lg:pl-6">
                            <ActionButtons
                              actions={actions.map((action, idx) => ({
                                id: `action-${idx}`,
                                label: action,
                                command: action,
                              }))}
                              onAction={handleAction}
                              disabled={isStreaming}
                            />
                          </div>
                        );
                      }
                      return null;
                    }

                    // 2. List Org Units -> Custom Card List
                    if (
                      toolName === "listOrgUnits" &&
                      toolPart.state === "output-available"
                    ) {
                      return (
                        <div key={partKey} className="pl-4 lg:pl-6">
                          <OrgUnitsList data={toolPart.output} />
                        </div>
                      );
                    }

                    // 3. Default -> Collapsible Tool View
                    return (
                      <Tool key={partKey}>
                        <ToolHeader
                          type={toolPart.type}
                          state={toolPart.state}
                          toolName={toolName}
                        />
                        <ToolContent>
                          <ToolInput input={toolPart.input} />
                          {toolPart.state === "output-available" && (
                            <ToolOutput
                              output={toolPart.output}
                              errorText={undefined}
                            />
                          )}
                          {toolPart.state === "output-error" && (
                            <ToolOutput
                              output={undefined}
                              errorText={toolPart.error}
                            />
                          )}
                        </ToolContent>
                      </Tool>
                    );
                  }

                  return null;
                })}

                {/* Domain-specific structured data rendered after parts */}
                {!isUser && (
                  <div className="space-y-4 pl-4 lg:pl-6">
                    {evidence?.connectorAnalysis?.flag && (
                      <ConnectorStatus analysis={evidence.connectorAnalysis} />
                    )}

                    {evidence?.planSteps && evidence.planSteps.length > 0 && (
                      <PlanSteps steps={evidence.planSteps} />
                    )}

                    {evidence?.evidence && (
                      <EvidencePanel evidence={evidence.evidence} />
                    )}

                    {evidence?.hypotheses && evidence.hypotheses.length > 0 && (
                      <HypothesesList hypotheses={evidence.hypotheses} />
                    )}

                    {evidence?.missingQuestions &&
                      evidence.missingQuestions.length > 0 && (
                        <MissingQuestionsList
                          questions={evidence.missingQuestions}
                        />
                      )}

                    {evidence?.nextSteps && evidence.nextSteps.length > 0 && (
                      <NextStepsPanel
                        steps={evidence.nextSteps}
                        onStepClick={handleAction}
                        disabled={isStreaming}
                      />
                    )}

                    {actions && actions.length > 0 && (
                      <ActionButtons
                        actions={actions}
                        onAction={handleAction}
                        disabled={isStreaming}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Submitted state loader */}
          {status === "submitted" && <Loader variant="dots" />}
        </ConversationContent>

        <ConversationScrollButton />
      </Conversation>

      {/* Input using PromptInput subcomponents */}
      <div className="border-t p-4 lg:p-6">
        <PromptInput onSubmit={handleSubmit} className="relative">
          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What would you like to know?"
              className="min-h-16 pr-12"
            />
          </PromptInputBody>
          <PromptInputFooter>
            <div /> {/* Spacer */}
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
