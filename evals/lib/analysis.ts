/**
 * Comprehensive analysis features: HTML reports, Gemini analysis, and pretty output.
 */

import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { mkdir, writeFile } from "node:fs/promises";
import { z } from "zod";

import type { EvalSummary } from "./reporter";

const OUTPUT_DIR = "evals/reports";
const DISPLAY_BOX_WIDTH = 58;

/**
 * Failure data for display.
 */
interface FailureData {
  id: string;
  title: string;
  reason: string;
}

/**
 * Category statistics.
 */
interface CategoryData {
  passed: number;
  failed: number;
  total: number;
}

/**
 * Aggregated totals across iterations.
 */
interface AggregatedTotals {
  passed: number;
  failed: number;
  total: number;
  durationMs: number;
}

/**
 * Aggregate multiple summaries into totals.
 */
export function aggregateSummaries(summaries: EvalSummary[]): AggregatedTotals {
  return {
    passed: summaries.reduce((sum, s) => sum + s.passed, 0),
    failed: summaries.reduce((sum, s) => sum + s.failed, 0),
    total: summaries.reduce((sum, s) => sum + s.totalCases, 0),
    durationMs: summaries.reduce((sum, s) => sum + s.durationMs, 0),
  };
}

/**
 * Aggregate category data across summaries.
 */
export function aggregateCategories(
  summaries: EvalSummary[]
): Record<string, CategoryData> {
  const categories: Record<string, CategoryData> = {};

  for (const summary of summaries) {
    for (const [cat, data] of Object.entries(summary.byCategory)) {
      categories[cat] ??= { passed: 0, failed: 0, total: 0 };
      categories[cat].passed += data.passed;
      categories[cat].failed += data.failed;
      categories[cat].total += data.total;
    }
  }

  return categories;
}

/**
 * Collect unique failures across summaries.
 */
export function collectFailures(summaries: EvalSummary[]): FailureData[] {
  const failureMap = new Map<string, FailureData>();

  for (const summary of summaries) {
    for (const failure of summary.failures) {
      failureMap.set(failure.id, failure);
    }
  }

  return [...failureMap.values()];
}

/**
 * Print iteration header.
 */
export function printIterationHeader(iteration: number, total: number): void {
  if (total > 1) {
    console.log(`\n── Iteration ${iteration}/${total} ──\n`);
  }
}

/**
 * Print comprehensive summary with box drawing.
 */
export function printComprehensiveSummary(
  totals: AggregatedTotals,
  categories: Record<string, CategoryData>,
  failures: FailureData[]
): void {
  const passRate = totals.total > 0 ? (totals.passed / totals.total) * 100 : 0;

  console.log("\n");
  console.log(`╔${"═".repeat(DISPLAY_BOX_WIDTH)}╗`);
  console.log(`║${" ".repeat(20)}RESULTS SUMMARY${" ".repeat(23)}║`);
  console.log(`╠${"═".repeat(DISPLAY_BOX_WIDTH)}╣`);
  console.log(
    `║  Total Cases:    ${String(totals.total).padStart(6)}                                 ║`
  );

  const passBar = "█".repeat(Math.round(passRate / 5));
  const emptyBar = "░".repeat(20 - Math.round(passRate / 5));
  console.log(
    `║  Passed:         ${String(totals.passed).padStart(6)}  ${passBar}${emptyBar}  ║`
  );

  console.log(
    `║  Failed:         ${String(totals.failed).padStart(6)}                                 ║`
  );
  console.log(
    `║  Pass Rate:      ${passRate.toFixed(1).padStart(5)}%                                 ║`
  );
  console.log(
    `║  Duration:       ${(totals.durationMs / 1000).toFixed(1).padStart(5)}s                                 ║`
  );
  console.log(`╠${"═".repeat(DISPLAY_BOX_WIDTH)}╣`);
  console.log("║  BY CATEGORY                                             ║");
  console.log(`╟${"─".repeat(DISPLAY_BOX_WIDTH)}╢`);

  for (const [cat, data] of Object.entries(categories).toSorted()) {
    const catRate = data.total > 0 ? (data.passed / data.total) * 100 : 0;
    const bar = `${"█".repeat(Math.round(catRate / 10))}${"░".repeat(10 - Math.round(catRate / 10))}`;
    console.log(
      `║  ${cat.padEnd(15)} ${String(data.passed).padStart(3)}/${String(data.total).padStart(3)}  ${bar}  ${catRate.toFixed(0).padStart(3)}%  ║`
    );
  }

  if (failures.length > 0) {
    console.log(`╠${"═".repeat(DISPLAY_BOX_WIDTH)}╣`);
    console.log("║  FAILURES                                                ║");
    console.log(`╟${"─".repeat(DISPLAY_BOX_WIDTH)}╢`);

    for (const f of failures.slice(0, 10)) {
      const title =
        f.title.length > 40 ? `${f.title.slice(0, 37)}...` : f.title;
      console.log(`║  ${f.id.padEnd(8)} ${title.padEnd(42)}  ║`);
    }

    if (failures.length > 10) {
      console.log(
        `║  ... and ${failures.length - 10} more                                       ║`
      );
    }
  }

  console.log(`╚${"═".repeat(DISPLAY_BOX_WIDTH)}╝`);
}

/**
 * Run Gemini analysis on results.
 */
export async function runGeminiAnalysis(
  totals: AggregatedTotals,
  categories: Record<string, CategoryData>,
  failures: FailureData[]
): Promise<void> {
  const passRate = totals.total > 0 ? (totals.passed / totals.total) * 100 : 0;

  console.log("\n⏳ Running Gemini analysis...\n");

  const AnalysisSchema = z.object({
    summary: z.string().describe("2-3 sentence executive summary"),
    insights: z.array(z.string()).describe("3-5 key insights"),
    recommendations: z
      .array(z.string())
      .describe("3-5 actionable recommendations"),
  });

  try {
    const { object: analysis } = await generateObject({
      model: google("gemini-2.5-pro-preview-05-06"),
      schema: AnalysisSchema,
      prompt: `Analyze these eval results for a Chrome Enterprise diagnostic AI assistant.
Focus on patterns, risks, and actionable improvements.

Results:
- Pass rate: ${passRate.toFixed(1)}%
- Categories: ${JSON.stringify(categories)}
- Failures: ${JSON.stringify(failures.slice(0, 20))}`,
    });

    console.log(`╔${"═".repeat(DISPLAY_BOX_WIDTH)}╗`);
    console.log(`║${" ".repeat(18)}GEMINI 2.5 PRO ANALYSIS${" ".repeat(17)}║`);
    console.log(`╠${"═".repeat(DISPLAY_BOX_WIDTH)}╣`);

    const words = analysis.summary.split(" ");
    let line = "║  ";
    for (const word of words) {
      if (line.length + word.length > 56) {
        console.log(`${line.padEnd(59)}║`);
        line = `║  ${word} `;
      } else {
        line += `${word} `;
      }
    }
    if (line.length > 4) {
      console.log(`${line.padEnd(59)}║`);
    }

    console.log(`╟${"─".repeat(DISPLAY_BOX_WIDTH)}╢`);
    console.log("║  KEY INSIGHTS                                            ║");
    for (const insight of analysis.insights) {
      const short =
        insight.length > 52 ? `${insight.slice(0, 49)}...` : insight;
      console.log(`║  • ${short.padEnd(53)} ║`);
    }

    console.log(`╟${"─".repeat(DISPLAY_BOX_WIDTH)}╢`);
    console.log("║  RECOMMENDATIONS                                         ║");
    for (const rec of analysis.recommendations) {
      const short = rec.length > 52 ? `${rec.slice(0, 49)}...` : rec;
      console.log(`║  → ${short.padEnd(53)} ║`);
    }

    console.log(`╚${"═".repeat(DISPLAY_BOX_WIDTH)}╝`);
  } catch (error) {
    console.log(
      "⚠️  Gemini analysis failed:",
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * Generate HTML report.
 */
export function generateHtmlReport(
  totals: AggregatedTotals,
  categories: Record<string, CategoryData>,
  failures: FailureData[]
): string {
  const passRate = totals.total > 0 ? (totals.passed / totals.total) * 100 : 0;

  const categoryRows = Object.entries(categories)
    .toSorted()
    .map(([cat, d]) => {
      const rate = d.total > 0 ? (d.passed / d.total) * 100 : 0;
      return `<tr><td>${cat}</td><td class="pass">${d.passed}</td><td class="fail">${d.failed}</td><td>${rate.toFixed(0)}%</td><td><div class="bar"><div class="bar-fill" style="width:${rate}%"></div></div></td></tr>`;
    })
    .join("");

  const failureRows =
    failures.length > 0
      ? `
  <h2>Failures</h2>
  <table>
    <tr><th>Case</th><th>Title</th><th>Reason</th></tr>
    ${failures.map((f) => `<tr><td>${f.id}</td><td>${f.title}</td><td style="color:#94a3b8;font-size:0.9rem">${f.reason.slice(0, 60)}...</td></tr>`).join("")}
  </table>
  `
      : "";

  return `<!DOCTYPE html>
<html>
<head>
  <title>Eval Report - ${new Date().toLocaleDateString()}</title>
  <style>
    body { font-family: system-ui; background: #0f172a; color: #f1f5f9; padding: 2rem; max-width: 900px; margin: 0 auto; }
    h1 { color: #38bdf8; border-bottom: 2px solid #334155; padding-bottom: 1rem; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 2rem 0; }
    .stat { background: #1e293b; padding: 1.5rem; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 2.5rem; font-weight: bold; color: #38bdf8; }
    .stat-label { color: #94a3b8; margin-top: 0.5rem; }
    .pass { color: #4ade80; }
    .fail { color: #f87171; }
    h2 { color: #e2e8f0; margin-top: 2rem; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #334155; }
    th { color: #94a3b8; font-weight: 500; }
    .bar { background: #334155; border-radius: 4px; height: 8px; overflow: hidden; }
    .bar-fill { background: linear-gradient(90deg, #4ade80, #38bdf8); height: 100%; }
  </style>
</head>
<body>
  <h1>CEP Hero Eval Report</h1>
  <p style="color:#94a3b8">${new Date().toLocaleString()}</p>

  <div class="stats">
    <div class="stat"><div class="stat-value">${totals.total}</div><div class="stat-label">Total Cases</div></div>
    <div class="stat"><div class="stat-value pass">${totals.passed}</div><div class="stat-label">Passed</div></div>
    <div class="stat"><div class="stat-value fail">${totals.failed}</div><div class="stat-label">Failed</div></div>
    <div class="stat"><div class="stat-value">${passRate.toFixed(1)}%</div><div class="stat-label">Pass Rate</div></div>
  </div>

  <h2>By Category</h2>
  <table>
    <tr><th>Category</th><th>Passed</th><th>Failed</th><th>Rate</th><th></th></tr>
    ${categoryRows}
  </table>

  ${failureRows}
</body>
</html>`;
}

/**
 * Write comprehensive report files.
 */
export async function writeComprehensiveReports(
  totals: AggregatedTotals,
  categories: Record<string, CategoryData>,
  failures: FailureData[]
): Promise<void> {
  const passRate = totals.total > 0 ? (totals.passed / totals.total) * 100 : 0;

  await mkdir(OUTPUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const report = { timestamp, totals, categories, failures, passRate };

  await writeFile(
    `${OUTPUT_DIR}/comprehensive-${timestamp}.json`,
    JSON.stringify(report, null, 2)
  );

  const html = generateHtmlReport(totals, categories, failures);
  await writeFile(`${OUTPUT_DIR}/comprehensive-${timestamp}.html`, html);

  console.log(`\n📄 Reports saved to ${OUTPUT_DIR}/`);
  console.log(`   • comprehensive-${timestamp}.json`);
  console.log(`   • comprehensive-${timestamp}.html\n`);
}
