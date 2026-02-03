/**
 * Eval report generation and output.
 * Handles writing reports to disk and formatting console output.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AssertionResult } from "./assertions";

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
  /** Actual tools that were called during the eval */
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
export function createRunId(date: Date = new Date()): string {
  return date.toISOString().replaceAll(/[:.]/g, "-");
}

/**
 * Write an individual eval report to disk.
 */
export async function writeEvalReport(
  report: EvalReport,
  reportsDir: string = DEFAULT_REPORTS_DIR
): Promise<string> {
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
): Promise<string> {
  await mkdir(reportsDir, { recursive: true });
  const fileName = `summary-${summary.runId}.json`;
  const outputPath = path.join(reportsDir, fileName);
  await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  return outputPath;
}

/**
 * Format a single case result for console output.
 */
export function formatCaseResult(report: EvalReport): string {
  const statusIcon =
    report.status === "pass"
      ? "PASS"
      : (report.status === "fail"
        ? "FAIL"
        : "ERR ");
  const duration = `${report.durationMs}ms`.padStart(7);
  return `[${statusIcon}] ${report.caseId} ${duration} - ${report.title}`;
}

/**
 * Format the summary for console output.
 */
export function formatSummary(summary: EvalSummary): string {
  const lines: string[] = [
    "",
    "═".repeat(60),
    "EVAL RUN SUMMARY",
    "═".repeat(60),
    "",
    `Run ID:    ${summary.runId}`,
    `Duration:  ${summary.durationMs}ms`,
    `Total:     ${summary.totalCases} cases`,
    `Passed:    ${summary.passed}`,
    `Failed:    ${summary.failed}`,
    `Errors:    ${summary.errors}`,
    "",
  ];

  if (Object.keys(summary.byCategory).length > 0) {
    lines.push("By Category:");
    for (const [category, stats] of Object.entries(summary.byCategory)) {
      const pct =
        stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;
      lines.push(`  ${category}: ${stats.passed}/${stats.total} (${pct}%)`);
    }
    lines.push("");
  }

  if (summary.failures.length > 0) {
    lines.push("Failures:");
    for (const failure of summary.failures) {
      lines.push(`  ${failure.id}: ${failure.reason}`);
    }
    lines.push("");
  }

  lines.push("═".repeat(60));
  return lines.join("\n");
}

/**
 * Build a summary from individual reports.
 */
export function buildSummary(
  runId: string,
  reports: EvalReport[],
  startTime: number
): EvalSummary {
  const byCategory: Record<
    string,
    { total: number; passed: number; failed: number }
  > = {};
  const failures: { id: string; title: string; reason: string }[] = [];

  let passed = 0;
  let failed = 0;
  let errors = 0;

  for (const report of reports) {
    if (!byCategory[report.category]) {
      byCategory[report.category] = { total: 0, passed: 0, failed: 0 };
    }
    byCategory[report.category].total++;

    if (report.status === "pass") {
      passed++;
      byCategory[report.category].passed++;
    } else if (report.status === "fail") {
      failed++;
      byCategory[report.category].failed++;
      failures.push({
        id: report.caseId,
        title: report.title,
        reason: report.error ?? "Assertion failed",
      });
    } else {
      errors++;
      failures.push({
        id: report.caseId,
        title: report.title,
        reason: report.error ?? "Unknown error",
      });
    }
  }

  return {
    runId,
    timestamp: new Date().toISOString(),
    totalCases: reports.length,
    passed,
    failed,
    errors,
    durationMs: Math.round(performance.now() - startTime),
    byCategory,
    failures,
  };
}
