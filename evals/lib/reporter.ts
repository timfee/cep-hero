/**
 * Eval report generation and output for writing results to disk and formatting console output.
 */

/* eslint-disable import/no-nodejs-modules */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { type AssertionResult } from "./assertions";

export type EvalReportStatus = "pass" | "fail" | "error";

export interface EvalReport {
  runId: string;
  caseId: string;
  title: string;
  category: string;
  tags: string[];
  sourceRefs: string[];
  caseFile: string;
  prompt: string;
  responseText: string;
  responseMetadata: unknown;
  expectedSchema: string[];
  schemaResult: AssertionResult;
  evidenceResult: AssertionResult;
  toolCallsResult?: AssertionResult;
  toolCalls?: string[];
  rubricResult?: {
    score: number;
    minScore: number;
    matched: string[];
    missed: string[];
    passed: boolean;
  };
  status: EvalReportStatus;
  durationMs: number;
  timestamp: string;
  error?: string;
}

export interface EvalSummary {
  runId: string;
  timestamp: string;
  totalCases: number;
  passed: number;
  failed: number;
  errors: number;
  durationMs: number;
  byCategory: Record<string, { total: number; passed: number; failed: number }>;
  failures: { id: string; title: string; reason: string }[];
}

const DEFAULT_REPORTS_DIR = path.join(process.cwd(), "evals", "reports");

/**
 * Generate a unique run ID based on timestamp.
 */
export function createRunId(date: Date = new Date()) {
  return date.toISOString().replaceAll(/[:.]/g, "-");
}

/**
 * Write an individual eval report to disk.
 */
export async function writeEvalReport(
  report: EvalReport,
  reportsDir: string = DEFAULT_REPORTS_DIR
) {
  await mkdir(reportsDir, { recursive: true });
  const fileName = `${report.caseId}-${report.runId}.json`;
  const outputPath = path.join(reportsDir, fileName);
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return outputPath;
}

/**
 * Write a summary report for the entire eval run.
 */
export async function writeSummaryReport(
  summary: EvalSummary,
  reportsDir: string = DEFAULT_REPORTS_DIR
) {
  await mkdir(reportsDir, { recursive: true });
  const fileName = `summary-${summary.runId}.json`;
  const outputPath = path.join(reportsDir, fileName);
  await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  return outputPath;
}

/**
 * Format a single case result for console output.
 */
export function formatCaseResult(report: EvalReport) {
  let statusIcon = "ERR ";
  if (report.status === "pass") {
    statusIcon = "PASS";
  } else if (report.status === "fail") {
    statusIcon = "FAIL";
  }
  const duration = `${report.durationMs}ms`.padStart(7);
  return `[${statusIcon}] ${report.caseId} ${duration} - ${report.title}`;
}

/**
 * Format summary header lines.
 */
function formatSummaryHeader(summary: EvalSummary) {
  return [
    "",
    "=".repeat(60),
    "EVAL RUN SUMMARY",
    "=".repeat(60),
    "",
    `Run ID:    ${summary.runId}`,
    `Duration:  ${summary.durationMs}ms`,
    `Total:     ${summary.totalCases} cases`,
    `Passed:    ${summary.passed}`,
    `Failed:    ${summary.failed}`,
    `Errors:    ${summary.errors}`,
    "",
  ];
}

/**
 * Format category statistics.
 */
function formatCategoryStats(summary: EvalSummary) {
  if (Object.keys(summary.byCategory).length === 0) {
    return [];
  }
  const lines = ["By Category:"];
  for (const [category, stats] of Object.entries(summary.byCategory)) {
    const pct =
      stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;
    lines.push(`  ${category}: ${stats.passed}/${stats.total} (${pct}%)`);
  }
  lines.push("");
  return lines;
}

/**
 * Format failure list.
 */
function formatFailureList(summary: EvalSummary) {
  if (summary.failures.length === 0) {
    return [];
  }
  const lines = ["Failures:"];
  for (const failure of summary.failures) {
    lines.push(`  ${failure.id}: ${failure.reason}`);
  }
  lines.push("");
  return lines;
}

/**
 * Format the summary for console output.
 */
export function formatSummary(summary: EvalSummary) {
  const lines = [
    ...formatSummaryHeader(summary),
    ...formatCategoryStats(summary),
    ...formatFailureList(summary),
    "=".repeat(60),
  ];
  return lines.join("\n");
}

interface SummaryAccumulator {
  byCategory: Record<string, { total: number; passed: number; failed: number }>;
  failures: { id: string; title: string; reason: string }[];
  passed: number;
  failed: number;
  errors: number;
}

/**
 * Create an empty summary accumulator.
 */
function createSummaryAccumulator(): SummaryAccumulator {
  return { byCategory: {}, failures: [], passed: 0, failed: 0, errors: 0 };
}

/**
 * Process a passed report into the accumulator.
 */
function processPassedReport(
  accumulator: SummaryAccumulator,
  report: EvalReport
) {
  accumulator.passed += 1;
  accumulator.byCategory[report.category].passed += 1;
}

/**
 * Process a failed report into the accumulator.
 */
function processFailedReport(
  accumulator: SummaryAccumulator,
  report: EvalReport
) {
  accumulator.failed += 1;
  accumulator.byCategory[report.category].failed += 1;
  accumulator.failures.push({
    id: report.caseId,
    title: report.title,
    reason: report.error ?? "Assertion failed",
  });
}

/**
 * Process an error report into the accumulator.
 */
function processErrorReport(
  accumulator: SummaryAccumulator,
  report: EvalReport
) {
  accumulator.errors += 1;
  accumulator.failures.push({
    id: report.caseId,
    title: report.title,
    reason: report.error ?? "Unknown error",
  });
}

/**
 * Process a single report into the accumulator.
 */
function processReport(accumulator: SummaryAccumulator, report: EvalReport) {
  accumulator.byCategory[report.category] ??= {
    total: 0,
    passed: 0,
    failed: 0,
  };
  accumulator.byCategory[report.category].total += 1;

  if (report.status === "pass") {
    processPassedReport(accumulator, report);
  } else if (report.status === "fail") {
    processFailedReport(accumulator, report);
  } else {
    processErrorReport(accumulator, report);
  }
}

/**
 * Build a summary from individual reports.
 */
export function buildSummary(
  runId: string,
  reports: EvalReport[],
  startTime: number
): EvalSummary {
  const accumulator = createSummaryAccumulator();
  for (const report of reports) {
    processReport(accumulator, report);
  }

  return {
    runId,
    timestamp: new Date().toISOString(),
    totalCases: reports.length,
    passed: accumulator.passed,
    failed: accumulator.failed,
    errors: accumulator.errors,
    durationMs: Math.round(performance.now() - startTime),
    byCategory: accumulator.byCategory,
    failures: accumulator.failures,
  };
}
