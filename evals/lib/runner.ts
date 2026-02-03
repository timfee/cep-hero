/**
 * Main eval runner - standalone execution without test framework.
 * This is the core eval execution engine that runs cases and collects results.
 */

import { callChat } from "@/lib/test-helpers/chat-client";
import {
  ensureEvalServer,
  releaseEvalServer,
} from "@/lib/test-helpers/eval-server";

import type { EvidenceCheckInput } from "./llm-judge";
import type { EvalCase } from "./registry";
import type { EvalReport, EvalSummary } from "./reporter";

import {
  checkRequiredEvidence,
  checkRequiredToolCalls,
  checkRubricScore,
  checkStructuredResponse,
  scoreRubric,
} from "./assertions";
import { buildEvalPrompt, loadEvalFixtures } from "./fixtures";
import { batchEvaluateEvidence } from "./llm-judge";
import { buildPromptMap, filterEvalCases, loadEvalRegistry } from "./registry";
import {
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

/**
 * Run evals with the given options.
 */
export async function runEvals(
  options: RunnerOptions = {}
): Promise<RunnerResult> {
  const {
    ids = process.env.EVAL_IDS,
    categories = process.env.EVAL_CATEGORY,
    tags = process.env.EVAL_TAGS,
    limit = process.env.EVAL_LIMIT,
    parallel = process.env.EVAL_SERIAL !== "1",
    pauseMs = process.env.EVAL_CASE_PAUSE_MS
      ? Number.parseInt(process.env.EVAL_CASE_PAUSE_MS, 10)
      : DEFAULT_CASE_PAUSE_MS,
    chatUrl = process.env.CHAT_URL ?? DEFAULT_CHAT_URL,
    manageServer = process.env.EVAL_MANAGE_SERVER !== "0",
    verbose = process.env.EVAL_VERBOSE === "1",
  } = options;

  const registry = loadEvalRegistry();
  const promptMap = buildPromptMap(registry);
  const runId = createRunId();
  const startTime = performance.now();

  const cases = filterEvalCases(registry.cases, {
    ids,
    categories,
    tags,
    limit,
  });

  if (cases.length === 0) {
    console.log("[eval] No cases selected");
    const summary: EvalSummary = {
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
    return { summary, reports: [] };
  }

  console.log(`[eval] Starting run ${runId}`);
  console.log(`[eval] Cases: ${cases.length}`);
  console.log(`[eval] Mode: ${parallel ? "parallel" : "serial"}`);

  if (manageServer) {
    await ensureEvalServer({ chatUrl, manageServer });
  }

  const reports: EvalReport[] = [];

  async function runCase(evalCase: EvalCase): Promise<EvalReport> {
    if (!parallel && pauseMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, pauseMs));
    }

    const basePrompt =
      promptMap.get(evalCase.id) ?? `Help me troubleshoot: ${evalCase.title}`;
    // By default, do NOT inject fixtures into prompt - force AI to call tools
    const prompt = buildEvalPrompt(basePrompt, {
      fixtures: evalCase.fixtures,
      overrides: evalCase.overrides,
      caseId: evalCase.id,
      // injectIntoPrompt defaults to false unless EVAL_INJECT_PROMPT=1
    });
    const fixtures = loadEvalFixtures(evalCase.id);
    const caseStart = performance.now();

    let responseText = "";
    let responseMetadata: unknown = undefined;
    let toolCalls: string[] | undefined;
    let error: string | undefined;

    try {
      const resp = await callChat(prompt, { fixtures });
      responseText = resp.text;
      responseMetadata = resp.metadata;
      ({ toolCalls } = resp);
    } catch (error) {
      error = error instanceof Error ? error.message : String(error);
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

    // Validate required tool calls (if specified)
    const toolCallsResult = checkRequiredToolCalls({
      toolCalls,
      requiredToolCalls: evalCase.required_tool_calls,
    });

    let rubricResult: EvalReport["rubricResult"] = undefined;
    if (evalCase.rubric) {
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

    let status: EvalReport["status"] = "pass";
    if (error) {
      status = "error";
    } else if (
      !schemaResult.passed ||
      !evidenceResult.passed ||
      !toolCallsResult.passed
    ) {
      status = "fail";
      if (!error) {
        error = !schemaResult.passed
          ? schemaResult.message
          : (!toolCallsResult.passed
            ? toolCallsResult.message
            : evidenceResult.message);
      }
    } else if (rubricResult && !rubricResult.passed) {
      status = "fail";
      if (!error) {
        error = `Rubric score ${rubricResult.score} below minimum ${rubricResult.minScore}`;
      }
    }

    const report: EvalReport = {
      runId,
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
      status,
      durationMs: Math.round(performance.now() - caseStart),
      timestamp: new Date().toISOString(),
      error,
    };

    await writeEvalReport(report);

    if (verbose) {
      console.log(formatCaseResult(report));
    } else {
      console.log(
        `[eval] ${report.caseId} ${report.status} ${report.durationMs}ms`
      );
    }

    return report;
  }

  if (parallel) {
    const results = await Promise.allSettled(cases.map(runCase));
    for (const result of results) {
      if (result.status === "fulfilled") {
        reports.push(result.value);
      }
    }
  } else {
    for (const evalCase of cases) {
      const report = await runCase(evalCase);
      reports.push(report);
    }
  }

  if (manageServer) {
    releaseEvalServer();
  }

  // LLM-as-judge phase: re-evaluate evidence failures with semantic matching
  const useLlmJudge = process.env.EVAL_LLM_JUDGE !== "0";
  if (useLlmJudge) {
    const evidenceFailures = reports.filter(
      (r) =>
        r.status === "fail" &&
        r.evidenceResult &&
        !r.evidenceResult.passed &&
        r.schemaResult?.passed // Only re-judge if schema passed
    );

    if (evidenceFailures.length > 0) {
      console.log(
        `[eval] Running LLM judge on ${evidenceFailures.length} evidence failures...`
      );

      const inputs: EvidenceCheckInput[] = evidenceFailures.map((r) => ({
        caseId: r.caseId,
        responseText: r.responseText,
        requiredEvidence:
          (r.evidenceResult?.details as { requiredEvidence?: string[] })
            ?.requiredEvidence ?? [],
      }));

      const llmResults = await batchEvaluateEvidence(inputs);

      // Update reports based on LLM judgment
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

          // Update status if LLM judge passed
          if (llmResult.passed && report.status === "fail") {
            report.status = "pass";
            report.error = undefined;
            console.log(
              `[eval] ${report.caseId} upgraded to pass by LLM judge`
            );
          }
        }
      }
    }
  }

  const summary = buildSummary(runId, reports, startTime);
  await writeSummaryReport(summary);

  console.log(formatSummary(summary));

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
