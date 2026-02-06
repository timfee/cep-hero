/**
 * Main chat console component providing the conversational interface.
 * Handles message rendering, tool output visualization, and user input.
 */

"use client";

import { track } from "@vercel/analytics";
import { type UIMessage, getToolName, isToolUIPart } from "ai";
import { RefreshCcwIcon, CopyIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import type { ActionItem } from "@/components/ai-elements/action-buttons";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import type { ToolPart } from "@/components/ai-elements/tool";
import type { OverviewData, Suggestion } from "@/lib/overview";
import type {
  ChromeEventsOutput,
  ConnectorConfigOutput,
  DlpRulesOutput,
  PolicyChangeConfirmationOutput,
  SuggestedActionsOutput,
  ToolResultOutput,
} from "@/types/chat";

import { ActionButtons } from "@/components/ai-elements/action-buttons";
import { ConnectorPoliciesCard } from "@/components/ai-elements/connector-policies-card";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { DlpRulesCard } from "@/components/ai-elements/dlp-rules-card";
import { EventsTable } from "@/components/ai-elements/events-table";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message";
import { PolicyChangeConfirmation } from "@/components/ai-elements/policy-change-confirmation";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputFooter,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";
import {
  Sources,
  SourcesTrigger,
  SourcesContent,
  Source,
} from "@/components/ai-elements/sources";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { ToolResultCard } from "@/components/ai-elements/tool-result-card";
import { useChatContext } from "@/components/chat/chat-context";
import {
  OrgUnitMapProvider,
  type OrgUnitInfo,
} from "@/components/ui/org-unit-context";
import { leafName, normalizeResource } from "@/lib/mcp/org-units";
import { cn } from "@/lib/utils";

import { OrgUnitsList } from "./org-units-list";

/**
 * Tools whose output is rendered by dedicated UI cards.
 * Only the last invocation per tool in a message is shown, earlier duplicates are suppressed.
 */
export const RICH_CARD_TOOLS = new Set([
  "getChromeEvents",
  "getChromeConnectorConfiguration",
  "listDLPRules",
  "listOrgUnits",
  "draftPolicyChange",
  "createDLPRule",
  "applyPolicyChange",
]);

import { HIDDEN_TOOL_NAMES } from "@/lib/mcp/constants";

/**
 * Context-gathering tools whose cards are suppressed when a message also
 * contains an action tool (applyPolicyChange, createDLPRule). This prevents
 * redundant re-display of data the AI fetched to prepare the action.
 */
const CONTEXT_TOOLS = new Set([
  "getChromeConnectorConfiguration",
  "listOrgUnits",
  "listDLPRules",
  "getChromeEvents",
]);

interface OrgUnitsOutput {
  orgUnits?: {
    orgUnitId?: string;
    name?: string;
    orgUnitPath?: string;
    parentOrgUnitId?: string;
    description?: string;
  }[];
}

interface KnowledgeHit {
  title?: string;
  url?: string;
}

interface SearchKnowledgeOutput {
  docs?: KnowledgeHit[];
  policies?: KnowledgeHit[];
}

/**
 * Unique source reference extracted from searchKnowledge tool outputs.
 */
interface ExtractedSource {
  title: string;
  url: string;
}

/**
 * Strip trailing "Sources" sections and stray inline markdown links
 * from agent text. The Sources drawer handles citation display.
 */
function stripSourcesFromText(text: string): string {
  // Remove trailing "Sources" / "**Sources**" sections (heading + everything after)
  const stripped = text.replace(
    /\n+(?:\*\*Sources?\*\*|#{1,3}\s*Sources?)\s*\n[\s\S]*$/i,
    ""
  );
  return stripped.trim();
}

/**
 * Extract unique sources from a message's searchKnowledge tool outputs.
 * Sources are displayed in a collapsible drawer — not inline in the text.
 */
function extractSourcesFromMessage(
  parts: UIMessage["parts"]
): ExtractedSource[] {
  const seen = new Set<string>();
  const sources: ExtractedSource[] = [];

  for (const part of parts) {
    if (isToolUIPart(part)) {
      const toolPart = part as ToolPart;
      if (
        getToolName(part) === "searchKnowledge" &&
        toolPart.state === "output-available"
      ) {
        const output = toolPart.output as SearchKnowledgeOutput;
        const hits = [...(output?.docs ?? []), ...(output?.policies ?? [])];
        for (const hit of hits) {
          if (hit.url && hit.title && !seen.has(hit.url)) {
            seen.add(hit.url);
            sources.push({ title: hit.title, url: hit.url });
          }
        }
      }
    }
  }

  return sources;
}

const CONFIRM_PATTERN = /^confirm\b/i;
const CANCEL_PATTERN = /^(cancel|no)\b/i;

const FALLBACK_ACTIONS: ActionItem[] = [
  {
    id: "hero-dlp-audit",
    label: "Create a DLP rule",
    command: "Create a DLP rule to audit all traffic",
  },
  {
    id: "hero-fleet-overview",
    label: "Fleet overview",
    command: "Show me a fleet overview",
  },
  {
    id: "fallback-events",
    label: "Recent security events",
    command: "Show recent security events",
  },
];

/**
 * Fetch JSON data from a URL, returning null on error.
 */
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    return null;
  }
  return res.json();
};

/**
 * Convert suggestions from overview data to action items for the chat.
 */
function suggestionsToActions(suggestions: Suggestion[]): ActionItem[] {
  return suggestions
    .toSorted((a, b) => a.priority - b.priority)
    .slice(0, 3)
    .map((s, idx) => ({
      id: `empty-${idx}`,
      label: s.text,
      command: s.action,
      primary: idx === 0,
    }));
}

import { generateWelcomeMessage } from "./welcome-message";

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

/**
 * Interactive chat console with message history, tool outputs, and action buttons.
 */
export function ChatConsole() {
  const { messages, sendMessage, status, input, setInput, stop, regenerate } =
    useChatContext();

  const { data: overviewData } = useSWR<OverviewData | null>(
    "/api/overview",
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      keepPreviousData: true,
    }
  );

  const isStreaming = status === "submitted" || status === "streaming";

  // Track which proposal is currently being applied (by proposalId)
  const [applyingProposalId, setApplyingProposalId] = useState<string | null>(
    null
  );

  const isWaitingForResponse = useMemo(() => {
    if (!isStreaming) return false;
    const lastMessage = messages.at(-1);
    return !lastMessage || lastMessage.role === "user";
  }, [isStreaming, messages]);

  // Clear applying state when streaming stops
  // Only react to isStreaming changes - applyingProposalId is intentionally excluded
  useEffect(() => {
    if (!isStreaming) {
      setApplyingProposalId(null);
    }
  }, [isStreaming]);

  const fallbackActions = useMemo(() => FALLBACK_ACTIONS, []);

  const welcomeMessage = useMemo(
    () => generateWelcomeMessage(overviewData ?? null),
    [overviewData]
  );

  /**
   * Build a map of org unit IDs to display info (name + path) from tool outputs.
   * Indexes each unit under multiple key formats for flexible resolution.
   */
  const orgUnitInfoMap = useMemo(() => {
    const map = new Map<string, OrgUnitInfo>();

    for (const message of messages) {
      for (const part of message.parts) {
        if (!isToolUIPart(part)) {
          continue;
        }
        if (part.state !== "output-available") {
          continue;
        }

        const toolName = getToolName(part);

        // Primary source: listOrgUnits provides the full org unit list
        if (toolName === "listOrgUnits") {
          const output = part.output as OrgUnitsOutput;
          const orgUnits = output?.orgUnits ?? [];
          for (const unit of orgUnits) {
            const id = unit.orgUnitId ?? "";
            const path = unit.orgUnitPath ?? unit.name ?? "";
            const name = unit.name ?? leafName(path);
            if (!id || !path) {
              continue;
            }
            const info: OrgUnitInfo = { name, path };
            const normalized = normalizeResource(id);
            map.set(normalized, info);
            map.set(`orgunits/${normalized}`, info);
            map.set(`id:${normalized}`, info);
          }
        }

        // Secondary source: connector config provides targetResource + targetResourceName
        if (toolName === "getChromeConnectorConfiguration") {
          const output = part.output as ConnectorConfigOutput;
          const target = output?.targetResource;
          const targetName = output?.targetResourceName;
          if (target && targetName) {
            const normalized = normalizeResource(target);
            const info: OrgUnitInfo = {
              name: leafName(targetName),
              path: targetName,
            };
            if (!map.has(normalized)) {
              map.set(normalized, info);
              map.set(`orgunits/${normalized}`, info);
              map.set(`id:${normalized}`, info);
            }
          }
        }
      }
    }

    return map;
  }, [messages]);

  const rootOrgUnitId = useMemo(() => {
    for (const [key, info] of orgUnitInfoMap.entries()) {
      if (info.path === "/") {
        return key.replace(/^orgunits\//, "").replace(/^id:/, "");
      }
    }
    return null;
  }, [orgUnitInfoMap]);

  /**
   * Replace org unit IDs in text with human-readable paths.
   */
  const sanitizeOrgUnitsInText = useCallback(
    (text: string) =>
      text.replace(/orgunits\/[a-z0-9_-]+/gi, (match) => {
        const normalized = normalizeResource(match);
        const resolved = orgUnitInfoMap.get(normalized);
        if (resolved) {
          return resolved.path;
        }
        const normalizedId = normalized.replace(/^orgunits\//, "");
        if (rootOrgUnitId && normalizedId === rootOrgUnitId) {
          return "/";
        }
        return "an org unit";
      }),
    [orgUnitInfoMap, rootOrgUnitId]
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
          if (toolPart.state !== "output-available") {
            return null;
          }
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

      if (streaming) {
        return [];
      }
      return fallbackActions;
    },
    [fallbackActions]
  );

  /**
   * Handle user message submission.
   */
  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      const trimmed = message.text?.trim();
      if (!trimmed) {
        return;
      }
      track("Chat Message Sent");
      void sendMessage({ text: trimmed });
    },
    [sendMessage]
  );

  /**
   * Handle action button clicks by sending the command as a message.
   */
  const handleAction = useCallback(
    (command: string) => {
      void sendMessage({ text: command });
    },
    [sendMessage]
  );

  return (
    <OrgUnitMapProvider map={orgUnitInfoMap}>
      <div className="flex h-full flex-col rounded-lg border border-border bg-card">
        <Conversation className="flex-1">
          <ConversationContent className="p-4 lg:p-6">
            {messages.length === 0 && !isStreaming && (
              <div className="space-y-4">
                <Message from="assistant" className="bg-muted p-4 lg:p-6">
                  <MessageContent>
                    <MessageResponse>
                      {sanitizeOrgUnitsInText(welcomeMessage)}
                    </MessageResponse>
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

            {messages.map((message, index) => {
              const isUser = message.role === "user";
              const isLast = index === messages.length - 1;
              const suggestedActions = getSuggestedActionsForMessage(message);
              const actionsToRender = deriveActions(
                suggestedActions,
                isStreaming
              );

              // Build a map of toolName → last part index for deduplication.
              // When the AI calls the same tool multiple times in one message,
              // only the last invocation's rich card is shown.
              const lastToolIndex = new Map<string, number>();
              let hasActionTool = false;
              for (let pi = 0; pi < message.parts.length; pi++) {
                const p = message.parts[pi];
                if (isToolUIPart(p)) {
                  const name = getToolName(p);
                  if (RICH_CARD_TOOLS.has(name)) {
                    lastToolIndex.set(name, pi);
                  }
                  if (
                    name === "applyPolicyChange" ||
                    name === "createDLPRule"
                  ) {
                    hasActionTool = true;
                  }
                }
              }

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
                            <MessageResponse>
                              {isUser
                                ? part.text
                                : sanitizeOrgUnitsInText(
                                    stripSourcesFromText(part.text)
                                  )}
                            </MessageResponse>
                          </MessageContent>
                          {!isUser && (
                            <MessageActions>
                              <MessageAction
                                onClick={async () => {
                                  await track("Response Regenerated");
                                  regenerate();
                                }}
                                tooltip="Regenerate"
                              >
                                <RefreshCcwIcon className="size-4" />
                              </MessageAction>
                              <MessageAction
                                onClick={async () => {
                                  await track("Response Copied");
                                  await navigator.clipboard.writeText(
                                    part.text
                                  );
                                }}
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

                      // Hidden tools: never render (sources/actions handled elsewhere)
                      if (HIDDEN_TOOL_NAMES.has(toolName)) {
                        return null;
                      }

                      // When an action tool (applyPolicyChange, createDLPRule) is
                      // present in this message, suppress redundant context-gathering
                      // cards that the AI re-fetched to prepare the action.
                      if (hasActionTool && CONTEXT_TOOLS.has(toolName)) {
                        return null;
                      }

                      // Dedup: for rich-card tools called multiple times,
                      // suppress earlier invocations so only the last card shows
                      if (
                        RICH_CARD_TOOLS.has(toolName) &&
                        lastToolIndex.get(toolName) !== i
                      ) {
                        return null;
                      }

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

                      if (
                        toolName === "draftPolicyChange" &&
                        toolPart.state === "output-available"
                      ) {
                        const output =
                          toolPart.output as PolicyChangeConfirmationOutput;
                        if (output?._type === "ui.confirmation") {
                          const proposalId = output.proposalId ?? partKey;
                          return (
                            <div key={partKey} className="pl-4 lg:pl-6">
                              <PolicyChangeConfirmation
                                proposal={output}
                                onConfirm={() => {
                                  setApplyingProposalId(proposalId);
                                  void sendMessage({ text: "Confirm" });
                                }}
                                onCancel={() => {
                                  void sendMessage({ text: "Cancel" });
                                }}
                                isApplying={applyingProposalId === proposalId}
                              />
                            </div>
                          );
                        }
                      }

                      // Tool result cards for action tools
                      if (
                        (toolName === "createDLPRule" ||
                          toolName === "applyPolicyChange") &&
                        toolPart.state === "output-available"
                      ) {
                        const output = toolPart.output as ToolResultOutput;
                        if (
                          output?._type === "ui.success" ||
                          output?._type === "ui.error" ||
                          output?._type === "ui.manual_steps"
                        ) {
                          return (
                            <div key={partKey} className="pl-4 lg:pl-6">
                              <ToolResultCard output={output} />
                            </div>
                          );
                        }
                      }

                      // Compact inline status for remaining tools (enrollBrowser, etc.)
                      // Shows a collapsed header; errors auto-expand with details.
                      const isError =
                        toolPart.state === "output-error" ||
                        toolPart.state === "output-denied";
                      const isRunning =
                        toolPart.state === "input-streaming" ||
                        toolPart.state === "input-available";

                      if (isRunning) {
                        return null;
                      }

                      return (
                        <Tool key={partKey} defaultOpen={isError}>
                          <ToolHeader
                            {...(toolPart.type === "dynamic-tool"
                              ? {
                                  type: toolPart.type,
                                  state: toolPart.state,
                                  toolName,
                                }
                              : {
                                  type: toolPart.type,
                                  state: toolPart.state,
                                })}
                          />
                          <ToolContent>
                            {isError && (
                              <ToolOutput
                                output={undefined}
                                errorText={
                                  toolPart.errorText ??
                                  (toolPart as { error?: string }).error
                                }
                              />
                            )}
                            {toolPart.state === "output-available" && (
                              <ToolOutput
                                output={toolPart.output}
                                errorText={undefined}
                              />
                            )}
                          </ToolContent>
                        </Tool>
                      );
                    }

                    return null;
                  })}

                  {!isUser &&
                    (() => {
                      const sources = extractSourcesFromMessage(message.parts);
                      if (sources.length === 0) return null;
                      return (
                        <div className="pl-4 lg:pl-6">
                          <Sources>
                            <SourcesTrigger count={sources.length} />
                            <SourcesContent>
                              {sources.map((s) => (
                                <Source
                                  key={s.url}
                                  href={s.url}
                                  title={s.title}
                                />
                              ))}
                            </SourcesContent>
                          </Sources>
                        </div>
                      );
                    })()}

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

            {isWaitingForResponse && (
              <div className="pl-4 lg:pl-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                  <span>Thinking...</span>
                </div>
              </div>
            )}

            {isStreaming && !isWaitingForResponse && (
              <div className="pl-4 lg:pl-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                  <span>Responding...</span>
                </div>
              </div>
            )}
          </ConversationContent>

          <ConversationScrollButton />
        </Conversation>

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
              <div />
              <PromptInputSubmit status={status} onStop={stop} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </OrgUnitMapProvider>
  );
}
