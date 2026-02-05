/**
 * Comprehensive analysis features: HTML reports, Gemini analysis, and pretty output.
 */

import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { mkdir, writeFile } from "node:fs/promises";
import { z } from "zod";

import { type EvalReport, type EvalSummary } from "./reporter";

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
export interface AggregatedTotals {
  passed: number;
  failed: number;
  errors: number;
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
    errors: summaries.reduce((sum, s) => sum + s.errors, 0),
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
 * Print the summary header box.
 */
function printSummaryHeader(): void {
  console.log("\n");
  console.log(`╔${"═".repeat(DISPLAY_BOX_WIDTH)}╗`);
  console.log(`║${" ".repeat(20)}RESULTS SUMMARY${" ".repeat(23)}║`);
  console.log(`╠${"═".repeat(DISPLAY_BOX_WIDTH)}╣`);
}

/**
 * Print totals section with pass rate bar.
 */
function printTotalsSection(totals: AggregatedTotals, passRate: number): void {
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
    `║  Errors:         ${String(totals.errors).padStart(6)}                                 ║`
  );
  console.log(
    `║  Pass Rate:      ${passRate.toFixed(1).padStart(5)}%                                 ║`
  );
  console.log(
    `║  Duration:       ${(totals.durationMs / 1000).toFixed(1).padStart(5)}s                                 ║`
  );
}

/**
 * Print categories section.
 */
function printCategoriesSection(
  categories: Record<string, CategoryData>
): void {
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
}

/**
 * Print failures section if any exist.
 */
function printFailuresSection(failures: FailureData[]): void {
  if (failures.length === 0) {
    return;
  }

  console.log(`╠${"═".repeat(DISPLAY_BOX_WIDTH)}╣`);
  console.log("║  FAILURES                                                ║");
  console.log(`╟${"─".repeat(DISPLAY_BOX_WIDTH)}╢`);

  for (const f of failures.slice(0, 10)) {
    const title = f.title.length > 40 ? `${f.title.slice(0, 37)}...` : f.title;
    console.log(`║  ${f.id.padEnd(8)} ${title.padEnd(42)}  ║`);
  }

  if (failures.length > 10) {
    console.log(
      `║  ... and ${failures.length - 10} more                                       ║`
    );
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

  printSummaryHeader();
  printTotalsSection(totals, passRate);
  printCategoriesSection(categories);
  printFailuresSection(failures);
  console.log(`╚${"═".repeat(DISPLAY_BOX_WIDTH)}╝`);
}

/**
 * Schema for Gemini analysis output.
 */
const AnalysisSchema = z.object({
  summary: z.string().describe("2-3 sentence executive summary"),
  insights: z.array(z.string()).describe("3-5 key insights"),
  recommendations: z
    .array(z.string())
    .describe("3-5 actionable recommendations"),
});

type AnalysisResult = z.infer<typeof AnalysisSchema>;

/**
 * Print wrapped text in a box line.
 */
function printWrappedSummary(summary: string): void {
  const words = summary.split(" ");
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
}

/**
 * Print analysis result box.
 */
function printAnalysisBox(analysis: AnalysisResult): void {
  console.log(`╔${"═".repeat(DISPLAY_BOX_WIDTH)}╗`);
  console.log(`║${" ".repeat(18)}GEMINI 2.5 PRO ANALYSIS${" ".repeat(17)}║`);
  console.log(`╠${"═".repeat(DISPLAY_BOX_WIDTH)}╣`);

  printWrappedSummary(analysis.summary);

  console.log(`╟${"─".repeat(DISPLAY_BOX_WIDTH)}╢`);
  console.log("║  KEY INSIGHTS                                            ║");
  for (const insight of analysis.insights) {
    const short = insight.length > 52 ? `${insight.slice(0, 49)}...` : insight;
    console.log(`║  • ${short.padEnd(53)} ║`);
  }

  console.log(`╟${"─".repeat(DISPLAY_BOX_WIDTH)}╢`);
  console.log("║  RECOMMENDATIONS                                         ║");
  for (const rec of analysis.recommendations) {
    const short = rec.length > 52 ? `${rec.slice(0, 49)}...` : rec;
    console.log(`║  → ${short.padEnd(53)} ║`);
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

    printAnalysisBox(analysis);
  } catch (error) {
    console.log(
      "⚠️  Gemini analysis failed:",
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Generate detailed case HTML section.
 */
function generateCaseDetailHtml(report: EvalReport): string {
  const statusClass = report.status === "pass" ? "pass" : "fail";
  const statusIcon = report.status === "pass" ? "✓" : "✗";

  const toolCallsHtml =
    report.toolCalls && report.toolCalls.length > 0
      ? `<div class="detail-row"><span class="detail-label">Tool Calls:</span><span class="tool-calls">${report.toolCalls.map((t) => `<code>${t}</code>`).join(" ")}</span></div>`
      : "";

  const schemaStatus = report.schemaResult.passed ? "pass" : "fail";
  const evidenceStatus = report.evidenceResult.passed ? "pass" : "fail";

  const missingEvidence =
    !report.evidenceResult.passed && report.evidenceResult.details?.missing
      ? `<div class="missing">Missing: ${(report.evidenceResult.details.missing as string[]).join(", ")}</div>`
      : "";

  return `
    <div class="case-card ${statusClass}">
      <div class="case-header">
        <span class="status-icon ${statusClass}">${statusIcon}</span>
        <span class="case-id">${report.caseId}</span>
        <span class="case-title">${escapeHtml(report.title)}</span>
        <span class="case-category">${report.category}</span>
        <span class="case-duration">${report.durationMs}ms</span>
      </div>
      <div class="case-body">
        <div class="case-section">
          <div class="section-title">Prompt</div>
          <div class="prompt-text">${escapeHtml(report.prompt)}</div>
        </div>
        <div class="case-section">
          <div class="section-title">Response</div>
          <div class="response-text">${escapeHtml(report.responseText || "(empty)")}</div>
        </div>
        <div class="case-section">
          <div class="section-title">Assertions</div>
          <div class="assertions">
            <div class="assertion ${schemaStatus}">
              <span class="assertion-name">Schema</span>
              <span class="assertion-result">${report.schemaResult.passed ? "Pass" : "Fail"}</span>
              <span class="assertion-msg">${escapeHtml(report.schemaResult.message)}</span>
            </div>
            <div class="assertion ${evidenceStatus}">
              <span class="assertion-name">Evidence</span>
              <span class="assertion-result">${report.evidenceResult.passed ? "Pass" : "Fail"}</span>
              <span class="assertion-msg">${escapeHtml(report.evidenceResult.message)}</span>
              ${missingEvidence}
            </div>
            ${toolCallsHtml}
          </div>
        </div>
        ${report.error ? `<div class="case-error">Error: ${escapeHtml(report.error)}</div>` : ""}
      </div>
    </div>`;
}

/**
 * Generate HTML report with detailed per-case information.
 */
export function generateHtmlReport(
  totals: AggregatedTotals,
  categories: Record<string, CategoryData>,
  failures: FailureData[],
  reports: EvalReport[] = []
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
  <h2>Failures Summary</h2>
  <table>
    <tr><th>Case</th><th>Title</th><th>Reason</th></tr>
    ${failures.map((f) => `<tr><td>${f.id}</td><td>${f.title}</td><td style="color:#94a3b8;font-size:0.9rem">${escapeHtml(f.reason)}</td></tr>`).join("")}
  </table>
  `
      : "";

  const sortedReports = [...reports].toSorted((a, b) => {
    if (a.status !== b.status) {
      return a.status === "fail" ? -1 : 1;
    }
    return a.caseId.localeCompare(b.caseId);
  });

  const caseDetailsHtml =
    sortedReports.length > 0
      ? `
  <h2>Detailed Results</h2>
  <div class="filter-controls">
    <button class="filter-btn active" data-filter="all">All (${reports.length})</button>
    <button class="filter-btn" data-filter="pass">Passed (${reports.filter((r) => r.status === "pass").length})</button>
    <button class="filter-btn" data-filter="fail">Failed (${reports.filter((r) => r.status === "fail").length})</button>
  </div>
  <div class="cases-list">
    ${sortedReports.map((r) => generateCaseDetailHtml(r)).join("")}
  </div>
  `
      : "";

  return `<!DOCTYPE html>
<html>
<head>
  <title>Eval Report - ${new Date().toLocaleDateString()}</title>
  <style>
    body { font-family: system-ui; background: #0f172a; color: #f1f5f9; padding: 2rem; max-width: 1200px; margin: 0 auto; }
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

    /* Case card styles */
    .filter-controls { margin: 1rem 0; display: flex; gap: 0.5rem; }
    .filter-btn { background: #1e293b; border: 1px solid #334155; color: #94a3b8; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; }
    .filter-btn:hover, .filter-btn.active { background: #334155; color: #f1f5f9; }
    .case-card { background: #1e293b; border-radius: 8px; margin: 1rem 0; border-left: 4px solid #334155; overflow: hidden; }
    .case-card.pass { border-left-color: #4ade80; }
    .case-card.fail { border-left-color: #f87171; }
    .case-header { display: flex; align-items: center; gap: 1rem; padding: 1rem; background: #0f172a; cursor: pointer; }
    .case-header:hover { background: #1e293b; }
    .status-icon { font-size: 1.2rem; width: 1.5rem; text-align: center; }
    .status-icon.pass { color: #4ade80; }
    .status-icon.fail { color: #f87171; }
    .case-id { font-family: monospace; color: #38bdf8; min-width: 5rem; }
    .case-title { flex: 1; }
    .case-category { background: #334155; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; color: #94a3b8; }
    .case-duration { color: #64748b; font-size: 0.85rem; }
    .case-body { padding: 1rem; display: none; }
    .case-card.expanded .case-body { display: block; }
    .case-section { margin: 1rem 0; }
    .section-title { color: #94a3b8; font-size: 0.85rem; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .prompt-text, .response-text { background: #0f172a; padding: 1rem; border-radius: 4px; white-space: pre-wrap; font-family: monospace; font-size: 0.9rem; max-height: 300px; overflow-y: auto; }
    .assertions { display: flex; flex-direction: column; gap: 0.5rem; }
    .assertion { display: flex; align-items: center; gap: 1rem; padding: 0.5rem; background: #0f172a; border-radius: 4px; }
    .assertion.pass { border-left: 3px solid #4ade80; }
    .assertion.fail { border-left: 3px solid #f87171; }
    .assertion-name { font-weight: 500; min-width: 6rem; }
    .assertion-result { font-size: 0.85rem; padding: 0.125rem 0.5rem; border-radius: 3px; }
    .assertion.pass .assertion-result { background: rgba(74, 222, 128, 0.2); color: #4ade80; }
    .assertion.fail .assertion-result { background: rgba(248, 113, 113, 0.2); color: #f87171; }
    .assertion-msg { color: #94a3b8; font-size: 0.85rem; flex: 1; }
    .missing { color: #f87171; font-size: 0.85rem; margin-top: 0.25rem; }
    .detail-row { display: flex; gap: 1rem; align-items: center; padding: 0.5rem 0; }
    .detail-label { color: #94a3b8; min-width: 6rem; }
    .tool-calls code { background: #334155; padding: 0.25rem 0.5rem; border-radius: 3px; margin-right: 0.5rem; font-size: 0.85rem; }
    .case-error { background: rgba(248, 113, 113, 0.1); border: 1px solid #f87171; padding: 0.75rem; border-radius: 4px; color: #f87171; margin-top: 1rem; }
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
  ${caseDetailsHtml}

  <script>
    // Toggle case expansion
    document.querySelectorAll('.case-header').forEach(header => {
      header.addEventListener('click', () => {
        header.closest('.case-card').classList.toggle('expanded');
      });
    });

    // Filter controls
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        document.querySelectorAll('.case-card').forEach(card => {
          if (filter === 'all') {
            card.style.display = 'block';
          } else {
            card.style.display = card.classList.contains(filter) ? 'block' : 'none';
          }
        });
      });
    });
  </script>
</body>
</html>`;
}

/**
 * Write comprehensive report files.
 */
export async function writeComprehensiveReports(
  totals: AggregatedTotals,
  categories: Record<string, CategoryData>,
  failures: FailureData[],
  reports: EvalReport[] = []
): Promise<void> {
  const passRate = totals.total > 0 ? (totals.passed / totals.total) * 100 : 0;

  await mkdir(OUTPUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const reportData = { timestamp, totals, categories, failures, passRate };

  await writeFile(
    `${OUTPUT_DIR}/comprehensive-${timestamp}.json`,
    JSON.stringify(reportData, null, 2)
  );

  const html = generateHtmlReport(totals, categories, failures, reports);
  await writeFile(`${OUTPUT_DIR}/comprehensive-${timestamp}.html`, html);

  console.log(`\n📄 Reports saved to ${OUTPUT_DIR}/`);
  console.log(`   • comprehensive-${timestamp}.json`);
  console.log(`   • comprehensive-${timestamp}.html\n`);
}
