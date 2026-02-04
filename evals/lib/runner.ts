/**
 * Core eval execution engine that runs cases and collects results without test framework dependency.
 */

import { type FixtureData } from "@/lib/mcp/types";
import { callChat, callChatMessages } from "@/lib/test-helpers/chat-client";
import {
  ensureEvalServer,
  releaseEvalServer,
} from "@/lib/test-helpers/eval-server";

import {
  aggregateCategories,
  aggregateSummaries,
  collectFailures,
  printComprehensiveSummary,
  printIterationHeader,
  runGeminiAnalysis,
  writeComprehensiveReports,
} from "./analysis";
import {
  checkForbiddenEvidence,
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
import { isPlainObject } from "./utils";

/** Pause between serial test cases to avoid overwhelming the server. */
const DEFAULT_CASE_PAUSE_MS = 250;

/** Default URL for the chat API endpoint. */
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

/**
 * Process assertions for a single conversation turn.
 */
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

/**
 * Build an error message from failed turns.
 */
function buildMultiTurnErrorMessage(failedTurns: TurnResult[]) {
  if (failedTurns.length === 0) {
    return;
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

interface MultiTurnChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface MultiTurnState {
  messages: MultiTurnChatMessage[];
  allToolCalls: string[];
  allResponses: string[];
  turnResults: TurnResult[];
}

/**
 * Create initial state for multi-turn conversation.
 */
function createMultiTurnState(): MultiTurnState {
  return {
    messages: [{ role: "system", content: "You are CEP Hero." }],
    allToolCalls: [],
    allResponses: [],
    turnResults: [],
  };
}

/**
 * Build the final result from multi-turn state.
 */
function buildMultiTurnResult(
  state: MultiTurnState,
  conversationScript: ConversationTurn[],
  error?: string
): MultiTurnResult {
  const failedTurns = state.turnResults.filter((t) => !t.passed);
  return {
    responseText: state.allResponses.join("\n\n---\n\n"),
    toolCalls: [...new Set(state.allToolCalls)],
    prompt: conversationScript.map((t) => t.content).join(" -> "),
    error: error ?? buildMultiTurnErrorMessage(failedTurns),
    turnResults: state.turnResults,
  };
}

/**
 * Process a single turn in a multi-turn conversation.
 */
async function processTurn(
  state: MultiTurnState,
  turn: ConversationTurn,
  turnIndex: number,
  turnAssertions: TurnAssertion[],
  fixtures: FixtureData | undefined
) {
  state.messages.push({ role: "user", content: turn.content });
  const resp = await callChatMessages(state.messages, { fixtures });
  const assistantText = resp.text;
  const turnToolCalls = resp.toolCalls ?? [];

  state.messages.push({ role: "assistant", content: assistantText });
  state.allToolCalls.push(...turnToolCalls);
  state.allResponses.push(assistantText);

  const turnAssertion = turnAssertions.find((a) => a.turn === turnIndex);
  state.turnResults.push(
    processTurnAssertion(turnIndex, turnToolCalls, assistantText, turnAssertion)
  );
}

/**
 * Run a multi-turn conversation and check per-turn assertions.
 */
async function runMultiTurnConversation(
  conversationScript: ConversationTurn[],
  turnAssertions: TurnAssertion[],
  fixtures: FixtureData | undefined
): Promise<MultiTurnResult> {
  const state = createMultiTurnState();

  for (
    let turnIndex = 0;
    turnIndex < conversationScript.length;
    turnIndex += 1
  ) {
    try {
      await processTurn(
        state,
        conversationScript[turnIndex],
        turnIndex,
        turnAssertions,
        fixtures
      );
    } catch (caughtError) {
      const errorMessage =
        caughtError instanceof Error
          ? caughtError.message
          : String(caughtError);
      return buildMultiTurnResult(
        state,
        conversationScript,
        `Turn ${turnIndex}: ${errorMessage}`
      );
    }
  }

  return buildMultiTurnResult(state, conversationScript);
}

interface AssertionResultSimple {
  passed: boolean;
  message: string;
}

/**
 * Collect failure messages from assertion results.
 */
function collectFailureMessages(
  schemaResult: AssertionResultSimple,
  evidenceResult: AssertionResultSimple,
  forbiddenEvidenceResult: AssertionResultSimple,
  toolCallsResult: AssertionResultSimple
) {
  const messages: string[] = [];
  if (!schemaResult.passed) {
    messages.push(schemaResult.message);
  }
  if (!toolCallsResult.passed) {
    messages.push(toolCallsResult.message);
  }
  if (!evidenceResult.passed) {
    messages.push(evidenceResult.message);
  }
  if (!forbiddenEvidenceResult.passed) {
    messages.push(forbiddenEvidenceResult.message);
  }
  return messages;
}

/**
 * Check if any assertions failed and return failure info.
 */
function checkAssertionFailures(
  schemaResult: AssertionResultSimple,
  evidenceResult: AssertionResultSimple,
  forbiddenEvidenceResult: AssertionResultSimple,
  toolCallsResult: AssertionResultSimple,
  error: string | undefined
) {
  const allPassed =
    schemaResult.passed &&
    evidenceResult.passed &&
    forbiddenEvidenceResult.passed &&
    toolCallsResult.passed;
  if (allPassed) {
    return null;
  }
  const messages = collectFailureMessages(
    schemaResult,
    evidenceResult,
    forbiddenEvidenceResult,
    toolCallsResult
  );
  return { status: "fail" as const, error: error ?? messages[0] };
}

/**
 * Determine the final report status based on all checks.
 */
function determineReportStatus(
  error: string | undefined,
  schemaResult: AssertionResultSimple,
  evidenceResult: AssertionResultSimple,
  forbiddenEvidenceResult: AssertionResultSimple,
  toolCallsResult: AssertionResultSimple,
  rubricResult: EvalReport["rubricResult"]
) {
  if (typeof error === "string" && error.length > 0) {
    return { status: "error" as const, error };
  }

  const assertionFail = checkAssertionFailures(
    schemaResult,
    evidenceResult,
    forbiddenEvidenceResult,
    toolCallsResult,
    error
  );
  if (assertionFail) {
    return assertionFail;
  }

  if (rubricResult && !rubricResult.passed) {
    return {
      status: "fail" as const,
      error:
        error ??
        `Rubric score ${rubricResult.score} below minimum ${rubricResult.minScore}`,
    };
  }

  return { status: "pass" as const, error: undefined };
}

/**
 * Run a single-turn eval case.
 */
async function runSingleTurnCase(
  evalCase: EvalCase,
  promptMap: Map<string, string>,
  fixtures: FixtureData | undefined
) {
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

interface CaseResponse {
  responseText: string;
  responseMetadata: unknown;
  toolCalls: string[] | undefined;
  prompt: string;
  error: string | undefined;
}

/**
 * Execute the conversation for an eval case.
 */
async function executeCaseConversation(
  evalCase: EvalCase,
  context: CaseRunContext,
  fixtures: FixtureData | undefined
): Promise<CaseResponse> {
  const isMultiTurn =
    evalCase.conversation_script.length > 0 && evalCase.mode === "multi-turn";

  if (isMultiTurn) {
    const result = await runMultiTurnConversation(
      evalCase.conversation_script,
      evalCase.turn_assertions ?? [],
      fixtures
    );
    return {
      responseText: result.responseText,
      responseMetadata: undefined,
      toolCalls: result.toolCalls,
      prompt: result.prompt,
      error: result.error,
    };
  }

  const result = await runSingleTurnCase(evalCase, context.promptMap, fixtures);
  return result;
}

interface AssertionResults {
  schemaResult: ReturnType<typeof checkStructuredResponse>;
  evidenceResult: ReturnType<typeof checkRequiredEvidence>;
  forbiddenEvidenceResult: ReturnType<typeof checkForbiddenEvidence>;
  toolCallsResult: ReturnType<typeof checkRequiredToolCalls>;
  rubricResult: EvalReport["rubricResult"];
}

/**
 * Run all assertions for a case response.
 */
function runAssertions(
  evalCase: EvalCase,
  response: CaseResponse
): AssertionResults {
  const schemaResult = checkStructuredResponse({
    text: response.responseText,
    metadata: response.responseMetadata,
    expectedSchema: evalCase.expected_schema,
  });

  const evidenceResult = checkRequiredEvidence({
    text: response.responseText,
    metadata: response.responseMetadata,
    requiredEvidence: evalCase.required_evidence,
  });

  const forbiddenEvidenceResult = checkForbiddenEvidence({
    text: response.responseText,
    metadata: response.responseMetadata,
    forbiddenEvidence: evalCase.forbidden_evidence,
  });

  const toolCallsResult = checkRequiredToolCalls({
    toolCalls: response.toolCalls,
    requiredToolCalls: evalCase.required_tool_calls,
  });

  const rubricResult = computeRubricResult(evalCase, response);

  return {
    schemaResult,
    evidenceResult,
    forbiddenEvidenceResult,
    toolCallsResult,
    rubricResult,
  };
}

/**
 * Compute rubric result if rubric is defined.
 */
function computeRubricResult(
  evalCase: EvalCase,
  response: CaseResponse
): EvalReport["rubricResult"] {
  if (evalCase.rubric === undefined) {
    return undefined;
  }
  const { score, matched, missed } = scoreRubric({
    text: response.responseText,
    metadata: response.responseMetadata,
    criteria: evalCase.rubric.criteria,
  });
  const rubricCheck = checkRubricScore({
    score,
    minScore: evalCase.rubric.min_score,
    criteria: evalCase.rubric.criteria,
  });
  return {
    score,
    minScore: evalCase.rubric.min_score,
    matched,
    missed,
    passed: rubricCheck.passed,
  };
}

/**
 * Build the final eval report from all results.
 */
function buildEvalReport(
  evalCase: EvalCase,
  context: CaseRunContext,
  response: CaseResponse,
  assertions: AssertionResults,
  caseStart: number
): EvalReport {
  const statusResult = determineReportStatus(
    response.error,
    assertions.schemaResult,
    assertions.evidenceResult,
    assertions.forbiddenEvidenceResult,
    assertions.toolCallsResult,
    assertions.rubricResult
  );

  return {
    runId: context.runId,
    caseId: evalCase.id,
    title: evalCase.title,
    category: evalCase.category,
    tags: evalCase.tags,
    sourceRefs: evalCase.source_refs,
    caseFile: evalCase.case_file,
    prompt: response.prompt,
    responseText: response.responseText,
    responseMetadata: response.responseMetadata,
    expectedSchema: evalCase.expected_schema,
    schemaResult: assertions.schemaResult,
    evidenceResult: assertions.evidenceResult,
    forbiddenEvidenceResult: assertions.forbiddenEvidenceResult,
    toolCallsResult: assertions.toolCallsResult,
    toolCalls: response.toolCalls,
    rubricResult: assertions.rubricResult,
    status: statusResult.status,
    durationMs: Math.round(performance.now() - caseStart),
    timestamp: new Date().toISOString(),
    error: statusResult.error,
  };
}

/**
 * Log case result to console.
 */
function logCaseResult(report: EvalReport, verbose: boolean) {
  if (verbose) {
    console.log(formatCaseResult(report));
  } else {
    console.log(
      `[eval] ${report.caseId} ${report.status} ${report.durationMs}ms`
    );
  }
}

/**
 * Run a single eval case end-to-end.
 */
async function runCase(
  evalCase: EvalCase,
  context: CaseRunContext
): Promise<EvalReport> {
  const fixtures = loadEvalFixtures(evalCase.id);
  const caseStart = performance.now();

  const response = await executeCaseConversation(evalCase, context, fixtures);
  const assertions = runAssertions(evalCase, response);
  const report = buildEvalReport(
    evalCase,
    context,
    response,
    assertions,
    caseStart
  );

  await writeEvalReport(report);
  logCaseResult(report, context.verbose);

  return report;
}

/**
 * Extract required evidence from assertion details.
 */
function getRequiredEvidenceFromDetails(result: EvalReport["evidenceResult"]) {
  const details = result?.details;
  if (!isPlainObject(details)) {
    return [];
  }
  const required = details.requiredEvidence;
  return Array.isArray(required)
    ? required.filter((item): item is string => typeof item === "string")
    : [];
}

/**
 * Check if a report is eligible for LLM judge re-evaluation.
 */
function isEligibleForLlmJudge(report: EvalReport) {
  const hasEvidenceFailure =
    report.status === "fail" &&
    report.evidenceResult !== undefined &&
    !report.evidenceResult.passed;
  const schemaPassed = report.schemaResult?.passed ?? false;
  return hasEvidenceFailure && schemaPassed;
}

interface LlmJudgeResult {
  passed: boolean;
  reasoning: string;
  presentEvidence: string[];
  missingEvidence: string[];
}

/**
 * Build evidence result from LLM judge output.
 */
function buildLlmEvidenceResult(
  llmResult: LlmJudgeResult
): EvalReport["evidenceResult"] {
  return {
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
}

/**
 * Update a report with LLM judge results.
 */
function updateReportWithLlmResult(
  report: EvalReport,
  llmResult: LlmJudgeResult
) {
  report.evidenceResult = buildLlmEvidenceResult(llmResult);
  if (llmResult.passed && report.status === "fail") {
    report.status = "pass";
    report.error = undefined;
    console.log(`[eval] ${report.caseId} upgraded to pass by LLM judge`);
  }
}

/**
 * Build evidence check inputs for LLM judge.
 */
function buildEvidenceInputs(failures: EvalReport[]): EvidenceCheckInput[] {
  return failures.map((r) => ({
    caseId: r.caseId,
    responseText: r.responseText,
    requiredEvidence: getRequiredEvidenceFromDetails(r.evidenceResult),
  }));
}

/**
 * Apply LLM judge results to reports.
 */
function applyLlmResultsToReports(
  reports: EvalReport[],
  llmResults: Map<string, LlmJudgeResult>
) {
  for (const report of reports) {
    const llmResult = llmResults.get(report.caseId);
    if (llmResult) {
      updateReportWithLlmResult(report, llmResult);
    }
  }
}

/**
 * Process evidence failures through LLM judge.
 */
async function processEvidenceFailures(evidenceFailures: EvalReport[]) {
  console.log(
    `[eval] Running LLM judge on ${evidenceFailures.length} evidence failures...`
  );
  const inputs = buildEvidenceInputs(evidenceFailures);
  const llmResults = await batchEvaluateEvidence(inputs);
  return llmResults;
}

/**
 * Apply LLM judge phase to re-evaluate evidence failures.
 */
async function applyLlmJudgePhase(reports: EvalReport[]) {
  const useLlmJudge = process.env.EVAL_LLM_JUDGE !== "0";
  if (!useLlmJudge) {
    return;
  }

  const evidenceFailures = reports.filter(isEligibleForLlmJudge);
  if (evidenceFailures.length === 0) {
    return;
  }

  const llmResults = await processEvidenceFailures(evidenceFailures);
  applyLlmResultsToReports(reports, llmResults);
}

/**
 * Parse pause milliseconds from string.
 */
function parsePauseMs(raw: string | undefined) {
  if (raw === undefined || raw === "") {
    return DEFAULT_CASE_PAUSE_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? DEFAULT_CASE_PAUSE_MS : parsed;
}

/**
 * Build an empty summary for when no cases are selected.
 */
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

/**
 * Run cases in parallel.
 */
async function runCasesParallel(cases: EvalCase[], context: CaseRunContext) {
  const results = await Promise.allSettled(
    cases.map(async (evalCase) => {
      const report = await runCase(evalCase, context);
      return report;
    })
  );
  return results
    .filter(
      (result): result is PromiseFulfilledResult<EvalReport> =>
        result.status === "fulfilled"
    )
    .map((result) => result.value);
}

/**
 * Run cases serially with optional pause between cases.
 */
async function runCasesSerial(
  cases: EvalCase[],
  context: CaseRunContext,
  pauseMs: number
) {
  const reports: EvalReport[] = [];
  for (const evalCase of cases) {
    if (pauseMs > 0) {
      await Bun.sleep(pauseMs);
    }
    const report = await runCase(evalCase, context);
    reports.push(report);
  }
  return reports;
}

/**
 * Execute all cases with the specified concurrency mode.
 */
async function executeCases(
  cases: EvalCase[],
  context: CaseRunContext,
  parallel: boolean,
  pauseMs: number
) {
  if (parallel) {
    const reports = await runCasesParallel(cases, context);
    return reports;
  }
  const reports = await runCasesSerial(cases, context, pauseMs);
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

/**
 * Resolve runner options from explicit values or environment variables.
 */
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

/**
 * Log the start of an eval run.
 */
function logRunStart(runId: string, caseCount: number, parallel: boolean) {
  console.log(`[eval] Starting run ${runId}`);
  console.log(`[eval] Cases: ${caseCount}`);
  console.log(`[eval] Mode: ${parallel ? "parallel" : "serial"}`);
}

/**
 * Finalize the eval run with LLM judge and summary.
 */
async function finalizeRun(
  runId: string,
  reports: EvalReport[],
  startTime: number
) {
  await applyLlmJudgePhase(reports);
  const summary = buildSummary(runId, reports, startTime);
  await writeSummaryReport(summary);
  console.log(formatSummary(summary));
  return summary;
}

interface EvalRunSetup {
  resolved: ResolvedOptions;
  runId: string;
  promptMap: Map<string, string>;
  startTime: number;
}

/**
 * Initialize an eval run.
 */
function initializeEvalRun(options: RunnerOptions): EvalRunSetup {
  const resolved = resolveOptions(options);
  const registry = loadEvalRegistry();
  const promptMap = buildPromptMap(registry);
  const runId = createRunId();
  const startTime = performance.now();
  return { resolved, runId, promptMap, startTime };
}

/**
 * Select cases to run based on filters.
 */
function selectCases(resolved: ResolvedOptions) {
  const registry = loadEvalRegistry();
  return filterEvalCases(registry.cases, {
    ids: resolved.ids,
    categories: resolved.categories,
    tags: resolved.tags,
    limit: resolved.limit,
  });
}

/**
 * Execute the main eval run.
 */
async function executeEvalRun(
  setup: EvalRunSetup,
  cases: EvalCase[]
): Promise<RunnerResult> {
  const { resolved, runId, promptMap, startTime } = setup;

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
 * Run evals with the given options.
 */
export async function runEvals(
  options: RunnerOptions = {}
): Promise<RunnerResult> {
  const setup = initializeEvalRun(options);
  const cases = selectCases(setup.resolved);

  if (cases.length === 0) {
    console.log("[eval] No cases selected");
    return { summary: buildEmptySummary(setup.runId), reports: [] };
  }

  const result = await executeEvalRun(setup, cases);
  return result;
}

/**
 * Options for the main entry point.
 */
export interface MainOptions {
  iterations?: number;
  html?: boolean;
  analyze?: boolean;
}

/**
 * CLI entry point with support for iterations, HTML reports, and analysis.
 */
export async function main(options: MainOptions = {}) {
  const { iterations = 1, html = false, analyze = false } = options;
  const summaries: EvalSummary[] = [];

  try {
    for (let i = 0; i < iterations; i++) {
      printIterationHeader(i + 1, iterations);
      const { summary } = await runEvals();
      summaries.push(summary);
    }

    // For multiple iterations, print comprehensive summary
    if (iterations > 1 || html || analyze) {
      const totals = aggregateSummaries(summaries);
      const categories = aggregateCategories(summaries);
      const failures = collectFailures(summaries);

      printComprehensiveSummary(totals, categories, failures);

      if (html) {
        await writeComprehensiveReports(totals, categories, failures);
      }

      if (analyze) {
        await runGeminiAnalysis(totals, categories, failures);
      }

      process.exit(totals.failed + totals.errors > 0 ? 1 : 0);
    } else {
      // Single iteration without extra features
      const summary = summaries[0];
      process.exit(summary.failed + summary.errors > 0 ? 1 : 0);
    }
  } catch (error) {
    console.error("[eval] Fatal error:", error);
    process.exit(1);
  }
}
