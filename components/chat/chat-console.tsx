import { getToolName, isToolUIPart } from "ai";
import { HelpCircle, RefreshCcwIcon, CopyIcon } from "lucide-react";
import { useCallback } from "react";

import type { ToolPart } from "@/components/ai-elements/tool";
import type {
  ChromeEventsOutput,
  ConnectorConfigOutput,
  DlpRulesOutput,
  SuggestedActionsOutput,
} from "@/types/chat";

import { ActionButtons } from "@/components/ai-elements/action-buttons";
import { ConnectorPoliciesCard } from "@/components/ai-elements/connector-policies-card";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { DlpRulesCard } from "@/components/ai-elements/dlp-rules-card";
import { EventsTable } from "@/components/ai-elements/events-table";
import { Loader } from "@/components/ai-elements/loader";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message";
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
import { cn } from "@/lib/utils";

import { OrgUnitsList } from "./org-units-list";

type OrgUnitsOutput = {
  orgUnits?: Array<{
    orgUnitId?: string;
    name?: string;
    orgUnitPath?: string;
    parentOrgUnitId?: string;
    description?: string;
  }>;
};

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
                    const toolPart = part as ToolPart;

                    // 1. Suggest Actions -> Action Buttons
                    if (
                      toolName === "suggestActions" &&
                      toolPart.state === "output-available"
                    ) {
                      const actions = (
                        toolPart.output as SuggestedActionsOutput
                      )?.actions;
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
                          <OrgUnitsList
                            data={(toolPart.output as OrgUnitsOutput) ?? {}}
                          />
                        </div>
                      );
                    }

                    // 3. Chrome events -> table view
                    if (
                      toolName === "getChromeEvents" &&
                      toolPart.state === "output-available"
                    ) {
                      return (
                        <div key={partKey} className="pl-4 lg:pl-6">
                          <EventsTable
                            output={
                              (toolPart.output as ChromeEventsOutput) ?? {}
                            }
                          />
                        </div>
                      );
                    }

                    // 4. DLP rules -> list view
                    if (
                      toolName === "listDLPRules" &&
                      toolPart.state === "output-available"
                    ) {
                      return (
                        <div key={partKey} className="pl-4 lg:pl-6">
                          <DlpRulesCard
                            output={(toolPart.output as DlpRulesOutput) ?? {}}
                          />
                        </div>
                      );
                    }

                    // 5. Connector configuration -> scope status
                    if (
                      toolName === "getChromeConnectorConfiguration" &&
                      toolPart.state === "output-available"
                    ) {
                      return (
                        <div key={partKey} className="pl-4 lg:pl-6">
                          <ConnectorPoliciesCard
                            output={
                              (toolPart.output as ConnectorConfigOutput) ?? {}
                            }
                          />
                        </div>
                      );
                    }

                    // Default -> Collapsible Tool View
                    const headerProps =
                      toolPart.type === "dynamic-tool"
                        ? {
                            type: toolPart.type,
                            state: toolPart.state,
                            toolName,
                          }
                        : { type: toolPart.type, state: toolPart.state };

                    return (
                      <Tool key={partKey}>
                        <ToolHeader {...headerProps} />
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
                              errorText={
                                toolPart.errorText ??
                                (toolPart as { error?: string }).error
                              }
                            />
                          )}
                        </ToolContent>
                      </Tool>
                    );
                  }

                  return null;
                })}
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
