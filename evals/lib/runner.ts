/**
 * Main eval runner - standalone execution without test framework.
 * This is the core eval execution engine that runs cases and collects results.
 */

import { type FixtureData } from "@/lib/mcp/types";
import { callChat, callChatMessages } from "@/lib/test-helpers/chat-client";
import {
  ensureEvalServer,
  releaseEvalServer,
} from "@/lib/test-helpers/eval-server";

import {
  checkRequiredEvidence,
  checkRequiredToolCalls,
  checkRubricScore,
  checkStructuredResponse,
  scoreRubric,
} from "./assertions";
import { buildEvalPrompt, loadEvalFixtures } from "./fixtures";
import { type EvidenceCheckInput, batchEvaluateEvidence } from "./llm-judge";
import {
  type ConversationTurn,
  type EvalCase,
  type TurnAssertion,
  buildPromptMap,
  filterEvalCases,
  loadEvalRegistry,
} from "./registry";
import {
  type EvalReport,
  type EvalSummary,
  buildSummary,
  createRunId,
  formatCaseResult,
  formatSummary,
  writeEvalReport,
  writeSummaryReport,
} from "./reporter";

const DEFAULT_CASE_PAUSE_MS = 250;
const DEFAULT_CHAT_URL = "http://localhost:3100/api/chat";

export interface RunnerOptions {
  ids?: string;
  categories?: string;
  tags?: string;
  limit?: string;
  parallel?: boolean;
  pauseMs?: number;
  chatUrl?: string;
  manageServer?: boolean;
  verbose?: boolean;
}

export interface RunnerResult {
  summary: EvalSummary;
  reports: EvalReport[];
}

interface MultiTurnResult {
  responseText: string;
  toolCalls: string[];
  prompt: string;
  error?: string;
  turnResults: {
    turn: number;
    passed: boolean;
    toolCalls: string[];
    missingToolCalls: string[];
    missingEvidence: string[];
  }[];
}

interface TurnResult {
  turn: number;
  passed: boolean;
  toolCalls: string[];
  missingToolCalls: string[];
  missingEvidence: string[];
}

interface CaseRunContext {
  runId: string;
  promptMap: Map<string, string>;
  verbose: boolean;
}

function processTurnAssertion(
  turnIndex: number,
  turnToolCalls: string[],
  assistantText: string,
  turnAssertion: TurnAssertion | undefined
): TurnResult {
  if (!turnAssertion) {
    return {
      turn: turnIndex,
      passed: true,
      toolCalls: turnToolCalls,
      missingToolCalls: [],
      missingEvidence: [],
    };
  }
  const requiredTools = turnAssertion.required_tool_calls ?? [];
  const missingToolCalls = requiredTools.filter(
    (tool) => !turnToolCalls.includes(tool)
  );

  const requiredEvidence = turnAssertion.required_evidence ?? [];
  const missingEvidence = requiredEvidence.filter(
    (evidence) => !assistantText.toLowerCase().includes(evidence.toLowerCase())
  );

  return {
    turn: turnIndex,
    passed: missingToolCalls.length === 0 && missingEvidence.length === 0,
    toolCalls: turnToolCalls,
    missingToolCalls,
    missingEvidence,
  };
}

function buildMultiTurnErrorMessage(
  failedTurns: TurnResult[]
): string | undefined {
  if (failedTurns.length === 0) {
    return undefined;
  }
  return failedTurns
    .map((t) => {
      const issues: string[] = [];
      if (t.missingToolCalls.length > 0) {
        issues.push(`missing tools: ${t.missingToolCalls.join(", ")}`);
      }
      if (t.missingEvidence.length > 0) {
        issues.push(`missing evidence: ${t.missingEvidence.join(", ")}`);
      }
      return `Turn ${t.turn}: ${issues.join("; ")}`;
    })
    .join(" | ");
}

/**
 * Run a multi-turn conversation and check per-turn assertions.
 */
async function runMultiTurnConversation(
  conversationScript: ConversationTurn[],
  turnAssertions: TurnAssertion[],
  fixtures: FixtureData | undefined
): Promise<MultiTurnResult> {
  interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
  }
  const messages: ChatMessage[] = [
    { role: "system", content: "You are CEP Hero." },
  ];

  const allToolCalls: string[] = [];
  const allResponses: string[] = [];
  const turnResults: TurnResult[] = [];

  for (
    let turnIndex = 0;
    turnIndex < conversationScript.length;
    turnIndex += 1
  ) {
    const turn = conversationScript[turnIndex];
    messages.push({ role: "user", content: turn.content });

    try {
      const resp = await callChatMessages(messages, { fixtures });
      const assistantText = resp.text;
      const turnToolCalls = resp.toolCalls ?? [];

      messages.push({ role: "assistant", content: assistantText });
      allToolCalls.push(...turnToolCalls);
      allResponses.push(assistantText);

      const turnAssertion = turnAssertions.find((a) => a.turn === turnIndex);
      const result = processTurnAssertion(
        turnIndex,
        turnToolCalls,
        assistantText,
        turnAssertion
      );
      turnResults.push(result);
    } catch (caughtError) {
      const errorMessage =
        caughtError instanceof Error
          ? caughtError.message
          : String(caughtError);

      return {
        responseText: allResponses.join("\n\n---\n\n"),
        toolCalls: [...new Set(allToolCalls)],
        prompt: conversationScript.map((t) => t.content).join(" -> "),
        error: `Turn ${turnIndex}: ${errorMessage}`,
        turnResults,
      };
    }
  }

  const failedTurns = turnResults.filter((t) => !t.passed);

  return {
    responseText: allResponses.join("\n\n---\n\n"),
    toolCalls: [...new Set(allToolCalls)],
    prompt: conversationScript.map((t) => t.content).join(" -> "),
    error: buildMultiTurnErrorMessage(failedTurns),
    turnResults,
  };
}

function determineReportStatus(
  error: string | undefined,
  schemaResult: { passed: boolean; message: string },
  evidenceResult: { passed: boolean; message: string },
  toolCallsResult: { passed: boolean; message: string },
  rubricResult: EvalReport["rubricResult"]
): { status: EvalReport["status"]; error: string | undefined } {
  if (typeof error === "string" && error.length > 0) {
    return { status: "error", error };
  }
  if (
    !schemaResult.passed ||
    !evidenceResult.passed ||
    !toolCallsResult.passed
  ) {
    const failureMessages: string[] = [];
    if (!schemaResult.passed) {
      failureMessages.push(schemaResult.message);
    }
    if (!toolCallsResult.passed) {
      failureMessages.push(toolCallsResult.message);
    }
    if (!evidenceResult.passed) {
      failureMessages.push(evidenceResult.message);
    }
    return { status: "fail", error: error ?? failureMessages[0] };
  }
  if (rubricResult && !rubricResult.passed) {
    return {
      status: "fail",
      error:
        error ??
        `Rubric score ${rubricResult.score} below minimum ${rubricResult.minScore}`,
    };
  }
  return { status: "pass", error: undefined };
}

async function runSingleTurnCase(
  evalCase: EvalCase,
  promptMap: Map<string, string>,
  fixtures: FixtureData | undefined
): Promise<{
  responseText: string;
  responseMetadata: unknown;
  toolCalls: string[] | undefined;
  prompt: string;
  error: string | undefined;
}> {
  const basePrompt =
    promptMap.get(evalCase.id) ?? `Help me troubleshoot: ${evalCase.title}`;
  const prompt = buildEvalPrompt(basePrompt, {
    fixtures: evalCase.fixtures,
    overrides: evalCase.overrides,
    caseId: evalCase.id,
  });

  try {
    const resp = await callChat(prompt, { fixtures });
    return {
      responseText: resp.text,
      responseMetadata: resp.metadata,
      toolCalls: resp.toolCalls,
      prompt,
      error: undefined,
    };
  } catch (caughtError) {
    const errorMsg =
      caughtError instanceof Error ? caughtError.message : String(caughtError);
    return {
      responseText: "",
      responseMetadata: undefined,
      toolCalls: undefined,
      prompt,
      error: errorMsg,
    };
  }
}

async function runCase(
  evalCase: EvalCase,
  context: CaseRunContext
): Promise<EvalReport> {
  const fixtures = loadEvalFixtures(evalCase.id);
  const caseStart = performance.now();

  let responseText: string;
  let responseMetadata: unknown;
  let toolCalls: string[] | undefined;
  let error: string | undefined;
  let prompt: string;

  const isMultiTurn =
    evalCase.conversation_script.length > 0 && evalCase.mode === "multi-turn";

  if (isMultiTurn) {
    const result = await runMultiTurnConversation(
      evalCase.conversation_script,
      evalCase.turn_assertions ?? [],
      fixtures
    );
    ({ responseText } = result);
    ({ toolCalls } = result);
    ({ error } = result);
    ({ prompt } = result);
    responseMetadata = undefined;
  } else {
    const result = await runSingleTurnCase(
      evalCase,
      context.promptMap,
      fixtures
    );
    ({ responseText } = result);
    ({ responseMetadata } = result);
    ({ toolCalls } = result);
    ({ prompt } = result);
    ({ error } = result);
  }

  const schemaResult = checkStructuredResponse({
    text: responseText,
    metadata: responseMetadata,
    expectedSchema: evalCase.expected_schema,
  });

  const evidenceResult = checkRequiredEvidence({
    text: responseText,
    metadata: responseMetadata,
    requiredEvidence: evalCase.required_evidence,
  });

  const toolCallsResult = checkRequiredToolCalls({
    toolCalls,
    requiredToolCalls: evalCase.required_tool_calls,
  });

  let rubricResult: EvalReport["rubricResult"] = undefined;
  if (evalCase.rubric !== undefined) {
    const { score, matched, missed } = scoreRubric({
      text: responseText,
      metadata: responseMetadata,
      criteria: evalCase.rubric.criteria,
    });
    const rubricCheck = checkRubricScore({
      score,
      minScore: evalCase.rubric.min_score,
      criteria: evalCase.rubric.criteria,
    });
    rubricResult = {
      score,
      minScore: evalCase.rubric.min_score,
      matched,
      missed,
      passed: rubricCheck.passed,
    };
  }

  const statusResult = determineReportStatus(
    error,
    schemaResult,
    evidenceResult,
    toolCallsResult,
    rubricResult
  );

  const report: EvalReport = {
    runId: context.runId,
    caseId: evalCase.id,
    title: evalCase.title,
    category: evalCase.category,
    tags: evalCase.tags,
    sourceRefs: evalCase.source_refs,
    caseFile: evalCase.case_file,
    prompt,
    responseText,
    responseMetadata,
    expectedSchema: evalCase.expected_schema,
    schemaResult,
    evidenceResult,
    toolCallsResult,
    toolCalls,
    rubricResult,
    status: statusResult.status,
    durationMs: Math.round(performance.now() - caseStart),
    timestamp: new Date().toISOString(),
    error: statusResult.error,
  };

  await writeEvalReport(report);

  if (context.verbose) {
    console.log(formatCaseResult(report));
  } else {
    console.log(
      `[eval] ${report.caseId} ${report.status} ${report.durationMs}ms`
    );
  }

  return report;
}

function getRequiredEvidenceFromDetails(
  result: EvalReport["evidenceResult"]
): string[] {
  const details = result?.details;
  if (!isRecord(details)) {
    return [];
  }
  const required = details.requiredEvidence;
  return Array.isArray(required)
    ? required.filter((item): item is string => typeof item === "string")
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isEligibleForLlmJudge(report: EvalReport): boolean {
  const hasEvidenceFailure =
    report.status === "fail" &&
    report.evidenceResult !== undefined &&
    !report.evidenceResult.passed;
  const schemaPassed = report.schemaResult?.passed ?? false;
  return hasEvidenceFailure && schemaPassed;
}

async function applyLlmJudgePhase(reports: EvalReport[]): Promise<void> {
  const useLlmJudge = process.env.EVAL_LLM_JUDGE !== "0";
  if (!useLlmJudge) {
    return;
  }

  const evidenceFailures = reports.filter(isEligibleForLlmJudge);
  if (evidenceFailures.length === 0) {
    return;
  }

  console.log(
    `[eval] Running LLM judge on ${evidenceFailures.length} evidence failures...`
  );

  const inputs: EvidenceCheckInput[] = evidenceFailures.map((r) => ({
    caseId: r.caseId,
    responseText: r.responseText,
    requiredEvidence: getRequiredEvidenceFromDetails(r.evidenceResult),
  }));

  const llmResults = await batchEvaluateEvidence(inputs);

  for (const report of reports) {
    const llmResult = llmResults.get(report.caseId);
    if (llmResult) {
      report.evidenceResult = {
        passed: llmResult.passed,
        message: llmResult.passed
          ? "LLM judge: All evidence present"
          : `LLM judge: Missing ${llmResult.missingEvidence.join(", ")}`,
        details: {
          llmJudge: true,
          reasoning: llmResult.reasoning,
          presentEvidence: llmResult.presentEvidence,
          missingEvidence: llmResult.missingEvidence,
        },
      };

      if (llmResult.passed && report.status === "fail") {
        report.status = "pass";
        report.error = undefined;
        console.log(`[eval] ${report.caseId} upgraded to pass by LLM judge`);
      }
    }
  }
}

function parsePauseMs(raw: string | undefined): number {
  if (raw === undefined || raw === "") {
    return DEFAULT_CASE_PAUSE_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? DEFAULT_CASE_PAUSE_MS : parsed;
}

function buildEmptySummary(runId: string): EvalSummary {
  return {
    runId,
    timestamp: new Date().toISOString(),
    totalCases: 0,
    passed: 0,
    failed: 0,
    errors: 0,
    durationMs: 0,
    byCategory: {},
    failures: [],
  };
}

async function executeCases(
  cases: EvalCase[],
  context: CaseRunContext,
  parallel: boolean,
  pauseMs: number
): Promise<EvalReport[]> {
  const reports: EvalReport[] = [];

  if (parallel) {
    const results = await Promise.allSettled(
      cases.map(async (evalCase) => runCase(evalCase, context))
    );
    for (const result of results) {
      if (result.status === "fulfilled") {
        reports.push(result.value);
      }
    }
  } else {
    for (const evalCase of cases) {
      if (pauseMs > 0) {
        await Bun.sleep(pauseMs);
      }
      const report = await runCase(evalCase, context);
      reports.push(report);
    }
  }

  return reports;
}

interface ResolvedOptions {
  ids?: string;
  categories?: string;
  tags?: string;
  limit?: string;
  parallel: boolean;
  pauseMs: number;
  chatUrl: string;
  manageServer: boolean;
  verbose: boolean;
}

function resolveOptions(options: RunnerOptions): ResolvedOptions {
  return {
    ids: options.ids ?? process.env.EVAL_IDS,
    categories: options.categories ?? process.env.EVAL_CATEGORY,
    tags: options.tags ?? process.env.EVAL_TAGS,
    limit: options.limit ?? process.env.EVAL_LIMIT,
    parallel: options.parallel ?? process.env.EVAL_SERIAL !== "1",
    pauseMs: options.pauseMs ?? parsePauseMs(process.env.EVAL_CASE_PAUSE_MS),
    chatUrl: options.chatUrl ?? process.env.CHAT_URL ?? DEFAULT_CHAT_URL,
    manageServer:
      options.manageServer ?? process.env.EVAL_MANAGE_SERVER !== "0",
    verbose: options.verbose ?? process.env.EVAL_VERBOSE === "1",
  };
}

function logRunStart(
  runId: string,
  caseCount: number,
  parallel: boolean
): void {
  console.log(`[eval] Starting run ${runId}`);
  console.log(`[eval] Cases: ${caseCount}`);
  console.log(`[eval] Mode: ${parallel ? "parallel" : "serial"}`);
}

async function finalizeRun(
  runId: string,
  reports: EvalReport[],
  startTime: number
): Promise<EvalSummary> {
  await applyLlmJudgePhase(reports);
  const summary = buildSummary(runId, reports, startTime);
  await writeSummaryReport(summary);
  console.log(formatSummary(summary));
  return summary;
}

/**
 * Run evals with the given options.
 */
export async function runEvals(
  options: RunnerOptions = {}
): Promise<RunnerResult> {
  const resolved = resolveOptions(options);
  const registry = loadEvalRegistry();
  const promptMap = buildPromptMap(registry);
  const runId = createRunId();
  const startTime = performance.now();

  const cases = filterEvalCases(registry.cases, {
    ids: resolved.ids,
    categories: resolved.categories,
    tags: resolved.tags,
    limit: resolved.limit,
  });

  if (cases.length === 0) {
    console.log("[eval] No cases selected");
    return { summary: buildEmptySummary(runId), reports: [] };
  }

  logRunStart(runId, cases.length, resolved.parallel);

  if (resolved.manageServer) {
    await ensureEvalServer({
      chatUrl: resolved.chatUrl,
      manageServer: resolved.manageServer,
    });
  }

  const context: CaseRunContext = {
    runId,
    promptMap,
    verbose: resolved.verbose,
  };
  const reports = await executeCases(
    cases,
    context,
    resolved.parallel,
    resolved.pauseMs
  );

  if (resolved.manageServer) {
    releaseEvalServer();
  }

  const summary = await finalizeRun(runId, reports, startTime);
  return { summary, reports };
}

/**
 * CLI entry point.
 */
export async function main(): Promise<void> {
  try {
    const { summary } = await runEvals();
    process.exit(summary.failed + summary.errors > 0 ? 1 : 0);
  } catch (error) {
    console.error("[eval] Fatal error:", error);
    process.exit(1);
  }
}
