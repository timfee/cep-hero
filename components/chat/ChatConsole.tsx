"use client";

import { useChat } from "@ai-sdk/react";
import { motion, AnimatePresence } from "motion/react";
import {
  SendHorizontal,
  Sparkles,
  User,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  ListChecks,
  HelpCircle,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
} from "@/components/ai-elements/message";
import {
  DashboardPanel,
  DashboardPanelContent,
  DashboardPanelDescription,
  DashboardPanelHeader,
  DashboardPanelTitle,
} from "@/components/ui/dashboard-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  Loader,
  ThinkingIndicator,
  ContentSkeleton,
} from "@/components/ai-elements/loader";
import type {
  DiagnosisPayload,
  Hypothesis,
  MissingQuestion,
  EvidencePayload,
} from "@/types/chat";

// Types for structured evidence from the API
interface EvidenceMetadata {
  planSteps?: string[];
  hypotheses?: Hypothesis[];
  nextSteps?: string[];
  missingQuestions?: MissingQuestion[];
  evidence?: EvidencePayload;
  connectorAnalysis?: {
    total: number;
    misScoped: number;
    flag: boolean;
    sampleTarget?: string;
  };
}

interface ActionItem {
  id: string;
  label?: string;
  command?: string;
  primary?: boolean;
}

// Collapsible section component for structured data
function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  badge,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-left transition-colors hover:bg-muted/50">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 text-xs font-medium text-foreground">
          {title}
        </span>
        {badge !== undefined && (
          <Badge variant="secondary" className="text-xs">
            {badge}
          </Badge>
        )}
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-2 rounded-lg border border-border bg-muted/30 p-3"
        >
          {children}
        </motion.div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Hypothesis display with confidence bar
function HypothesisItem({ hypothesis }: { hypothesis: Hypothesis }) {
  const confidencePercent = Math.round((hypothesis.confidence ?? 0) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-2"
    >
      <div className="flex items-start gap-2">
        <Lightbulb className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
        <p className="text-xs text-foreground">{hypothesis.cause}</p>
      </div>
      <div className="ml-5 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <motion.div
            className={cn(
              "h-full rounded-full",
              confidencePercent >= 70
                ? "bg-status-positive"
                : confidencePercent >= 40
                  ? "bg-status-warning"
                  : "bg-muted-foreground"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${confidencePercent}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {confidencePercent}%
        </span>
      </div>
      {hypothesis.evidence && hypothesis.evidence.length > 0 && (
        <ul className="ml-5 space-y-1">
          {hypothesis.evidence.map((ev, i) => (
            <li
              key={i}
              className="text-xs text-muted-foreground before:mr-1.5 before:content-['-']"
            >
              {ev}
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}

// Evidence check display
function EvidenceCheckItem({
  check,
  index,
}: {
  check: {
    name: string;
    status: "pass" | "fail" | "unknown";
    detail?: string;
    source?: string;
  };
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-start gap-2"
    >
      {check.status === "pass" ? (
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-status-positive" />
      ) : check.status === "fail" ? (
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-destructive" />
      ) : (
        <HelpCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground">{check.name}</p>
        {check.detail && (
          <p className="text-xs text-muted-foreground">{check.detail}</p>
        )}
        {check.source && (
          <p className="text-xs italic text-muted-foreground/70">
            Source: {check.source}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// Streaming loading state
function StreamingState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="ml-10 space-y-3"
    >
      <ThinkingIndicator message="Analyzing your request" />
      <ContentSkeleton lines={3} className="max-w-md" />
    </motion.div>
  );
}

// Structured response renderer
function StructuredResponse({
  evidence,
  actions,
  onAction,
}: {
  evidence?: EvidenceMetadata;
  actions?: ActionItem[];
  onAction: (command: string) => void;
}) {
  if (!evidence) return null;

  const {
    planSteps,
    hypotheses,
    nextSteps,
    missingQuestions,
    evidence: evidenceData,
    connectorAnalysis,
  } = evidence;

  const hasStructuredContent =
    (planSteps && planSteps.length > 0) ||
    (hypotheses && hypotheses.length > 0) ||
    (nextSteps && nextSteps.length > 0) ||
    (missingQuestions && missingQuestions.length > 0) ||
    (evidenceData?.checks && evidenceData.checks.length > 0);

  if (!hasStructuredContent) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="mt-4 space-y-3"
    >
      {/* Connector Analysis Alert */}
      {connectorAnalysis?.flag && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-status-warning" />
          <div>
            <p className="text-xs font-medium text-foreground">
              Connector scope issue detected
            </p>
            <p className="text-xs text-muted-foreground">
              Policies may be mis-scoped
              {connectorAnalysis.sampleTarget &&
                ` (sample: ${connectorAnalysis.sampleTarget})`}
            </p>
          </div>
        </motion.div>
      )}

      {/* Plan Steps */}
      {planSteps && planSteps.length > 0 && (
        <CollapsibleSection
          title="What I checked"
          icon={ListChecks}
          badge={planSteps.length}
          defaultOpen
        >
          <ul className="space-y-1.5">
            {planSteps.map((step, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-2 text-xs text-foreground"
              >
                <CheckCircle2 className="mt-0.5 h-3 w-3 flex-shrink-0 text-status-positive" />
                {step}
              </motion.li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {/* Evidence Checks */}
      {evidenceData?.checks && evidenceData.checks.length > 0 && (
        <CollapsibleSection
          title="Evidence"
          icon={CheckCircle2}
          badge={evidenceData.checks.length}
        >
          <div className="space-y-2">
            {evidenceData.checks.map((check, i) => (
              <EvidenceCheckItem key={i} check={check} index={i} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Hypotheses */}
      {hypotheses && hypotheses.length > 0 && (
        <CollapsibleSection
          title="Hypotheses"
          icon={Lightbulb}
          badge={hypotheses.length}
          defaultOpen
        >
          <div className="space-y-3">
            {hypotheses.slice(0, 3).map((h, i) => (
              <HypothesisItem key={i} hypothesis={h} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Missing Questions */}
      {missingQuestions && missingQuestions.length > 0 && (
        <CollapsibleSection
          title="Questions for you"
          icon={HelpCircle}
          badge={missingQuestions.length}
          defaultOpen
        >
          <div className="space-y-2">
            {missingQuestions.map((q, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-md border border-primary/20 bg-primary/5 p-2"
              >
                <p className="text-xs font-medium text-foreground">
                  {q.question}
                </p>
                {q.why && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Why: {q.why}
                  </p>
                )}
                {q.example && (
                  <p className="mt-1 text-xs italic text-muted-foreground/70">
                    Example: {q.example}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Next Steps with Actions */}
      {nextSteps && nextSteps.length > 0 && (
        <CollapsibleSection
          title="Recommended next steps"
          icon={ExternalLink}
          badge={nextSteps.length}
          defaultOpen
        >
          <div className="space-y-2">
            {nextSteps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between gap-2"
              >
                <span className="text-xs text-foreground">{step}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={() => onAction(step)}
                >
                  Run
                </Button>
              </motion.div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Quick Actions */}
      {actions && actions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {actions.map((action) => (
            <Button
              key={action.id}
              size="sm"
              variant={action.primary ? "default" : "secondary"}
              className="h-7 text-xs"
              onClick={() => {
                const cmd = action.command ?? action.label ?? action.id;
                if (cmd) onAction(cmd);
              }}
            >
              {action.label ?? action.id}
            </Button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export function ChatConsole() {
  const { messages, sendMessage, status } = useChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isStreaming = status === "submitted" || status === "streaming";
  const isSubmitted = status === "submitted";

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isStreaming]);

  // Listen for cross-page action dispatches (e.g., overview cards)
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { command?: string };
      if (!detail?.command) return;
      void sendMessage({ text: detail.command });
    };
    document.addEventListener("cep-action", handler);
    return () => document.removeEventListener("cep-action", handler);
  }, [sendMessage]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput("");
    await sendMessage({ text: trimmed });
  };

  const handleAction = (command: string) => {
    void sendMessage({ text: command });
  };

  return (
    <DashboardPanel className="flex h-full min-h-[500px] flex-col">
      {/* Header */}
      <DashboardPanelHeader className="flex items-center gap-3">
        <motion.div
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"
          aria-hidden="true"
          animate={isStreaming ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <Sparkles className="h-4 w-4 text-primary" />
        </motion.div>
        <div className="flex-1">
          <DashboardPanelTitle>CEP Assistant</DashboardPanelTitle>
          <DashboardPanelDescription>
            Guided fixes with actions
          </DashboardPanelDescription>
        </div>
        <AnimatePresence>
          {isStreaming && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
            >
              <ThinkingIndicator message={isSubmitted ? "Processing" : "Responding"} />
            </motion.div>
          )}
        </AnimatePresence>
      </DashboardPanelHeader>

      {/* Messages Area */}
      <DashboardPanelContent className="flex-1 overflow-hidden p-0">
        <div
          ref={scrollRef}
          className="h-full space-y-4 overflow-y-auto px-4 py-4"
          role="log"
          aria-label="Chat messages"
          aria-live="polite"
        >
          <AnimatePresence mode="popLayout">
            {messages.length === 0 && !isStreaming && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex h-full flex-col items-center justify-center text-center"
              >
                <motion.div
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <Sparkles className="h-6 w-6 text-primary" />
                </motion.div>
                <h3 className="text-sm font-medium text-foreground">
                  Start a conversation
                </h3>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Ask about Chrome Enterprise Premium configurations, connector
                  issues, or DLP policies.
                </p>
              </motion.div>
            )}

            {messages.map((message, messageIndex) => {
              const isUser = message.role === "user";
              const metadata = message.metadata as Record<string, unknown> | undefined;
              const actions = metadata?.actions as ActionItem[] | undefined;
              const evidence = metadata?.evidence as EvidenceMetadata | undefined;

              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: messageIndex * 0.05 }}
                >
                  <Message from={isUser ? "user" : "assistant"}>
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

                    <MessageContent className="ml-10 max-w-none">
                      {message.parts.map((part, idx) => {
                        if (part.type !== "text") return null;
                        // Parse out structured sections from text
                        const text = part.text;
                        const diagnosisMatch = text.match(/^Diagnosis:\s*(.+?)(?=\n|$)/m);
                        const diagnosis = diagnosisMatch?.[1];

                        // Show diagnosis prominently
                        if (diagnosis && !isUser) {
                          return (
                            <motion.div
                              key={idx}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="space-y-2"
                            >
                              <p className="text-sm font-medium leading-relaxed text-foreground">
                                {diagnosis}
                              </p>
                            </motion.div>
                          );
                        }

                        // For user messages or messages without diagnosis prefix
                        return (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                          >
                            {part.text.split(/\n{2,}/).map((block, blockIdx) => (
                              <p
                                key={blockIdx}
                                className="whitespace-pre-wrap text-sm leading-relaxed text-foreground"
                              >
                                {block}
                              </p>
                            ))}
                          </motion.div>
                        );
                      })}
                    </MessageContent>

                    {/* Structured data display for assistant messages */}
                    {!isUser && (
                      <div className="ml-10">
                        <StructuredResponse
                          evidence={evidence}
                          actions={actions}
                          onAction={handleAction}
                        />
                      </div>
                    )}
                  </Message>
                </motion.div>
              );
            })}

            {/* Streaming indicator */}
            {isSubmitted && (
              <motion.div
                key="streaming"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Message from="assistant">
                  <div className="flex items-center gap-2">
                    <motion.div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary"
                      aria-hidden="true"
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      <Sparkles className="h-4 w-4" />
                    </motion.div>
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Assistant
                    </span>
                  </div>
                  <StreamingState />
                </Message>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DashboardPanelContent>

      {/* Input Form */}
      <motion.form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-border bg-muted/50 px-4 py-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <label htmlFor="chat-input" className="sr-only">
          Message input
        </label>
        <Input
          id="chat-input"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isStreaming
              ? "Assistant is responding..."
              : "Ask CEP or trigger an action"
          }
          className="flex-1 transition-opacity"
          disabled={isStreaming}
          aria-describedby={isStreaming ? "streaming-status" : undefined}
        />
        {isStreaming && (
          <span id="streaming-status" className="sr-only">
            Assistant is currently responding. Please wait.
          </span>
        )}
        <Button
          type="submit"
          disabled={isStreaming || !input.trim()}
          size="icon"
          aria-label="Send message"
          className="transition-transform active:scale-95"
        >
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </motion.form>
    </DashboardPanel>
  );
}
