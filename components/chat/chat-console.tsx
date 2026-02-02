import { getToolName, isToolUIPart } from "ai";
import { RefreshCcwIcon, CopyIcon } from "lucide-react";
import { useCallback, useMemo } from "react";
import useSWR from "swr";

import type { ToolPart } from "@/components/ai-elements/tool";
import type { OverviewData, Suggestion } from "@/lib/overview";
import type {
  ChromeEventsOutput,
  ConnectorConfigOutput,
  DlpRulesOutput,
  SuggestedActionsOutput,
} from "@/types/chat";

import {
  ActionButtons,
  type ActionItem,
} from "@/components/ai-elements/action-buttons";
import { ConnectorPoliciesCard } from "@/components/ai-elements/connector-policies-card";
import {
  Conversation,
  ConversationContent,
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

const CONFIRM_PATTERN = /^confirm\b/i;
const CANCEL_PATTERN = /^(cancel|no)\b/i;

const FALLBACK_ACTIONS: ActionItem[] = [
  {
    id: "fallback-connector-config",
    label: "Review connector settings",
    command: "Review connector settings",
  },
  {
    id: "fallback-dlp-rules",
    label: "List data protection rules",
    command: "List data protection rules",
  },
  {
    id: "fallback-events",
    label: "Show recent security events",
    command: "Show recent security events",
  },
  {
    id: "fallback-org-units",
    label: "List organizational units",
    command: "List organizational units",
  },
];

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
};

/**
 * Convert suggestions from overview data to action items for the chat.
 */
function suggestionsToActions(suggestions: Suggestion[]): ActionItem[] {
  return suggestions
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3)
    .map((s, idx) => ({
      id: `empty-${idx}`,
      label: s.text.length > 40 ? s.text.slice(0, 40) + "..." : s.text,
      command: s.action,
      primary: idx === 0,
    }));
}

/**
 * Generate a dynamic welcome message based on fleet state.
 */
function generateWelcomeMessage(data: OverviewData | null): string {
  if (!data) {
    return `Hey there! I'm your Chrome Enterprise Premium assistant. I'm ready to help you manage and secure your browser fleet.

What would you like to work on?`;
  }

  const suggestions = data.suggestions || [];
  const hasCriticalCards = data.postureCards?.some(
    (c) => c.status === "critical"
  );

  if (suggestions.length === 0 && !hasCriticalCards) {
    return `Hey there! I'm your Chrome Enterprise Premium assistant. I've reviewed your fleet and things look good!

${data.summary || "Your security posture appears healthy."}

Is there anything specific you'd like me to help you with?`;
  }

  const actionItems = suggestions.slice(0, 3).map((s) => {
    if (s.category === "security") {
      return `**Security** - ${s.text}`;
    } else if (s.category === "compliance") {
      return `**Compliance** - ${s.text}`;
    } else if (s.category === "monitoring") {
      return `**Monitoring** - ${s.text}`;
    }
    return `**${s.category}** - ${s.text}`;
  });

  return `Hey there! I'm your Chrome Enterprise Premium assistant. I've been looking at your fleet data and found some things we should address.

${data.headline || ""}

${actionItems.length > 0 ? actionItems.join("\n\n") : ""}

What would you like to tackle first?`;
}

/**
 * Map string actions to ActionItem objects with confirm/cancel detection.
 */
function mapActionsForSuggestion(actions: string[], key: string): ActionItem[] {
  const normalizedActions = actions.map((a) => a.trim()).filter(Boolean);
  const hasConfirm = normalizedActions.some((a) => CONFIRM_PATTERN.test(a));

  return normalizedActions.map((action, idx) => {
    const isConfirm = CONFIRM_PATTERN.test(action);
    const isCancel = CANCEL_PATTERN.test(action);

    return {
      id: `${key}-${idx}`,
      label: action,
      command: action,
      primary: hasConfirm ? isConfirm : idx === 0 && !isCancel,
    };
  });
}

export function ChatConsole() {
  const { messages, sendMessage, status, input, setInput, stop, regenerate } =
    useChatContext();

  const { data: overviewData } = useSWR<OverviewData | null>(
    "/api/overview",
    fetcher,
    { revalidateOnFocus: false }
  );

  const isStreaming = status === "submitted" || status === "streaming";

  const fallbackActions = useMemo(() => FALLBACK_ACTIONS, []);

  const welcomeMessage = useMemo(
    () => generateWelcomeMessage(overviewData ?? null),
    [overviewData]
  );

  const emptyStateActions = useMemo(() => {
    if (overviewData?.suggestions && overviewData.suggestions.length > 0) {
      return suggestionsToActions(overviewData.suggestions);
    }
    return FALLBACK_ACTIONS.slice(0, 3).map((a, idx) => ({
      ...a,
      primary: idx === 0,
    }));
  }, [overviewData]);

  /**
   * Extract suggested actions from a message's tool parts.
   */
  const getSuggestedActionsForMessage = useCallback(
    (message: (typeof messages)[number]) => {
      const entries = message.parts
        .map((part, idx) => ({ part, idx }))
        .filter(
          ({ part }) =>
            isToolUIPart(part) && getToolName(part) === "suggestActions"
        )
        .map(({ part, idx }) => {
          const toolPart = part as ToolPart;
          if (toolPart.state !== "output-available") return null;
          const actions =
            (toolPart.output as SuggestedActionsOutput)?.actions ?? [];
          return {
            key: `${message.id ?? "msg"}-${idx}`,
            actions,
          };
        })
        .filter(
          (entry): entry is { key: string; actions: string[] } => entry !== null
        );

      return entries.at(-1) ?? null;
    },
    []
  );

  /**
   * Derive actions to render: use suggested actions if available, otherwise fallback.
   */
  const deriveActions = useCallback(
    (
      suggestedActions: { key: string; actions?: string[] } | null,
      streaming: boolean
    ): ActionItem[] => {
      if (suggestedActions) {
        return mapActionsForSuggestion(
          suggestedActions.actions ?? [],
          suggestedActions.key
        );
      }

      if (streaming) return [];
      return fallbackActions;
    },
    [fallbackActions]
  );

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
          {/* Empty state styled as a contextual system message */}
          {messages.length === 0 && !isStreaming && (
            <div className="space-y-4">
              <Message from="assistant" className="bg-muted p-4 lg:p-6">
                <MessageContent>
                  <MessageResponse>{welcomeMessage}</MessageResponse>
                </MessageContent>
              </Message>
              <div className="pl-4 lg:pl-6">
                <ActionButtons
                  actions={emptyStateActions}
                  onAction={handleAction}
                  disabled={isStreaming}
                  resetKey={status}
                />
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((message, index) => {
            const isUser = message.role === "user";
            const isLast = index === messages.length - 1;
            const suggestedActions = getSuggestedActionsForMessage(message);
            const actionsToRender = deriveActions(
              suggestedActions,
              isStreaming
            );

            return (
              <div key={message.id || index} className="space-y-4">
                {message.parts.map((part, i) => {
                  const partKey = `${message.id || index}-${i}`;

                  if (part.type === "reasoning") {
                    return (
                      <Reasoning
                        key={partKey}
                        isStreaming={isStreaming && isLast}
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

                    // 1. Suggest Actions -> Skip inline rendering (moved to end of message)
                    if (toolName === "suggestActions") {
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

                {/* Action buttons at end of assistant messages */}
                {!isUser && isLast && actionsToRender.length > 0 && (
                  <div className="pl-4 lg:pl-6">
                    <ActionButtons
                      actions={actionsToRender}
                      onAction={handleAction}
                      disabled={isStreaming}
                      resetKey={`${message.id ?? index}-${status}`}
                    />
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
