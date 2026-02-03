/**
 * Aggregates results from multiple eval runs for analysis.
 */

import { createRunId } from "../lib/reporter";
import {
  type AggregatedResults,
  type AggregateStats,
  type CaseAnalysis,
  type CategoryAnalysis,
  type RunMode,
  type SingleRunResult,
} from "./types";

/**
 * Determine consistency status for a case across runs.
 */
function determineConsistency(
  results: CaseAnalysis["results"]
): CaseAnalysis["consistency"] {
  const passCount = results.filter((r) => r.status === "pass").length;
  const failCount = results.filter((r) => r.status !== "pass").length;

  if (passCount === results.length) {
    return "stable-pass";
  }
  if (failCount === results.length) {
    return "stable-fail";
  }
  return "flaky";
}

/**
 * Build aggregate statistics across all runs.
 */
function buildAggregateStats(runs: SingleRunResult[]): AggregateStats {
  const byMode: AggregateStats["byMode"] = {} as AggregateStats["byMode"];
  let totalCases = 0;
  let totalExecutions = 0;
  let totalPassed = 0;

  for (const run of runs) {
    const { mode } = run;
    if (!byMode[mode]) {
      byMode[mode] = {
        passRate: 0,
        avgDurationMs: 0,
        passed: 0,
        failed: 0,
        errors: 0,
      };
    }

    byMode[mode].passed += run.summary.passed;
    byMode[mode].failed += run.summary.failed;
    byMode[mode].errors += run.summary.errors;
    byMode[mode].avgDurationMs += run.summary.durationMs;

    totalCases = Math.max(totalCases, run.summary.totalCases);
    totalExecutions += run.summary.totalCases;
    totalPassed += run.summary.passed;
  }

  for (const mode of Object.keys(byMode) as RunMode[]) {
    const modeRuns = runs.filter((r) => r.mode === mode);
    const total =
      byMode[mode].passed + byMode[mode].failed + byMode[mode].errors;
    byMode[mode].passRate = total > 0 ? byMode[mode].passed / total : 0;
    byMode[mode].avgDurationMs =
      modeRuns.length > 0
        ? Math.round(byMode[mode].avgDurationMs / modeRuns.length)
        : 0;
  }

  return {
    totalCases,
    totalExecutions,
    overallPassRate: totalExecutions > 0 ? totalPassed / totalExecutions : 0,
    byMode,
  };
}

/**
 * Analyze individual cases across all runs.
 */
function buildCaseAnalysis(runs: SingleRunResult[]): CaseAnalysis[] {
  const caseMap = new Map<string, CaseAnalysis>();

  for (const run of runs) {
    for (const report of run.reports) {
      if (!caseMap.has(report.caseId)) {
        caseMap.set(report.caseId, {
          caseId: report.caseId,
          title: report.title,
          category: report.category,
          results: [],
          consistency: "stable-pass",
          passRate: 0,
        });
      }

      const analysis = caseMap.get(report.caseId);
      if (analysis) {
        analysis.results.push({
          mode: run.mode,
          status: report.status,
          durationMs: report.durationMs,
          error: report.error,
        });
      }
    }
  }

  for (const analysis of caseMap.values()) {
    analysis.consistency = determineConsistency(analysis.results);
    const passCount = analysis.results.filter(
      (r) => r.status === "pass"
    ).length;
    analysis.passRate =
      analysis.results.length > 0 ? passCount / analysis.results.length : 0;
  }

  return [...caseMap.values()].toSorted((a, b) =>
    a.caseId.localeCompare(b.caseId)
  );
}

/**
 * Analyze results by category.
 */
function buildCategoryAnalysis(
  runs: SingleRunResult[],
  caseAnalysis: CaseAnalysis[]
): CategoryAnalysis[] {
  const categoryMap = new Map<string, CategoryAnalysis>();

  const categories = [...new Set(caseAnalysis.map((c) => c.category))];

  for (const category of categories) {
    const categoryCases = caseAnalysis.filter((c) => c.category === category);
    const passRateByMode: Record<RunMode, number> = {} as Record<
      RunMode,
      number
    >;

    const modes = [...new Set(runs.map((r) => r.mode))];
    for (const mode of modes) {
      const modeResults = categoryCases.flatMap((c) =>
        c.results.filter((r) => r.mode === mode)
      );
      const passCount = modeResults.filter((r) => r.status === "pass").length;
      passRateByMode[mode] =
        modeResults.length > 0 ? passCount / modeResults.length : 0;
    }

    const avgPassRate =
      categoryCases.length > 0
        ? categoryCases.reduce((sum, c) => sum + c.passRate, 0) /
          categoryCases.length
        : 0;

    const problematicCases = categoryCases
      .filter((c) => c.passRate < 0.8)
      .map((c) => c.caseId);

    categoryMap.set(category, {
      category,
      totalCases: categoryCases.length,
      passRateByMode,
      avgPassRate,
      problematicCases,
    });
  }

  return [...categoryMap.values()].toSorted((a, b) =>
    a.category.localeCompare(b.category)
  );
}

/**
 * Aggregate all run results into a comprehensive analysis.
 */
export function aggregateResults(runs: SingleRunResult[]): AggregatedResults {
  const runId = createRunId();
  const configurations = [...new Set(runs.map((r) => r.mode))];
  const caseAnalysis = buildCaseAnalysis(runs);
  const categoryAnalysis = buildCategoryAnalysis(runs, caseAnalysis);
  const aggregateStats = buildAggregateStats(runs);

  return {
    runId,
    timestamp: new Date().toISOString(),
    totalRuns: runs.length,
    configurations,
    runs,
    aggregateStats,
    caseAnalysis,
    categoryAnalysis,
  };
}

/**
 * Get a summary of the aggregation for logging.
 */
export function formatAggregationSummary(results: AggregatedResults): string {
  const lines: string[] = [
    "",
    "=".repeat(70),
    "AGGREGATED RESULTS SUMMARY",
    "=".repeat(70),
    "",
    `Run ID: ${results.runId}`,
    `Total Runs: ${results.totalRuns}`,
    `Configurations: ${results.configurations.join(", ")}`,
    `Total Cases: ${results.aggregateStats.totalCases}`,
    `Overall Pass Rate: ${(results.aggregateStats.overallPassRate * 100).toFixed(1)}%`,
    "",
    "Pass Rate by Mode:",
  ];

  for (const [mode, stats] of Object.entries(results.aggregateStats.byMode)) {
    lines.push(
      `  ${mode}: ${(stats.passRate * 100).toFixed(1)}% (${stats.passed}/${stats.passed + stats.failed + stats.errors})`
    );
  }

  const flakyCases = results.caseAnalysis.filter(
    (c) => c.consistency === "flaky"
  );
  if (flakyCases.length > 0) {
    lines.push("");
    lines.push(`Flaky Cases (${flakyCases.length}):`);
    for (const c of flakyCases.slice(0, 10)) {
      lines.push(`  ${c.caseId}: ${(c.passRate * 100).toFixed(0)}% pass rate`);
    }
    if (flakyCases.length > 10) {
      lines.push(`  ... and ${flakyCases.length - 10} more`);
    }
  }

  const failingCases = results.caseAnalysis.filter(
    (c) => c.consistency === "stable-fail"
  );
  if (failingCases.length > 0) {
    lines.push("");
    lines.push(`Consistently Failing Cases (${failingCases.length}):`);
    for (const c of failingCases.slice(0, 10)) {
      lines.push(`  ${c.caseId}: ${c.title}`);
    }
    if (failingCases.length > 10) {
      lines.push(`  ... and ${failingCases.length - 10} more`);
    }
  }

  lines.push("");
  lines.push("=".repeat(70));

  return lines.join("\n");
}
