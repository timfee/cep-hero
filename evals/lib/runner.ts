/**
 * Main eval runner - standalone execution without test framework.
 * This is the core eval execution engine that runs cases and collects results.
 */

import { callChat } from "@/lib/test-helpers/chat-client";
import {
  ensureEvalServer,
  releaseEvalServer,
} from "@/lib/test-helpers/eval-server";

import type { EvalCase } from "./registry";
import type { EvalReport, EvalSummary } from "./reporter";

import {
  checkRequiredEvidence,
  checkRubricScore,
  checkStructuredResponse,
  scoreRubric,
} from "./assertions";
import { buildEvalPrompt, loadEvalFixtures } from "./fixtures";
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

export type RunnerOptions = {
  ids?: string;
  categories?: string;
  tags?: string;
  limit?: string;
  parallel?: boolean;
  pauseMs?: number;
  chatUrl?: string;
  manageServer?: boolean;
  verbose?: boolean;
};

export type RunnerResult = {
  summary: EvalSummary;
  reports: EvalReport[];
};

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
    const prompt = buildEvalPrompt(basePrompt, {
      fixtures: evalCase.fixtures,
      overrides: evalCase.overrides,
      caseId: evalCase.id,
    });
    const fixtures = loadEvalFixtures(evalCase.id);
    const caseStart = performance.now();

    let responseText = "";
    let responseMetadata: unknown = undefined;
    let error: string | undefined;

    try {
      const resp = await callChat(prompt, { fixtures });
      responseText = resp.text;
      responseMetadata = resp.metadata;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
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
    } else if (!schemaResult.passed || !evidenceResult.passed) {
      status = "fail";
      if (!error) {
        error = !schemaResult.passed
          ? schemaResult.message
          : evidenceResult.message;
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
  } catch (err) {
    console.error("[eval] Fatal error:", err);
    process.exit(1);
  }
}
