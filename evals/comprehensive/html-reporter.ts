/**
 * HTML report generator for comprehensive eval results.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { DEFAULT_OUTPUT_DIR } from "./config";
import { type ComprehensiveReport } from "./types";

/**
 * Escape HTML special characters.
 */
function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Get priority badge color.
 */
function getPriorityColor(
  priority: "critical" | "high" | "medium" | "low"
): string {
  switch (priority) {
    case "critical": {
      return "#dc2626";
    }
    case "high": {
      return "#f97316";
    }
    case "medium": {
      return "#eab308";
    }
    case "low": {
      return "#22c55e";
    }
    default: {
      return "#6b7280";
    }
  }
}

/**
 * Get risk level color.
 */
function getRiskColor(risk: "low" | "medium" | "high" | "critical"): string {
  return getPriorityColor(risk);
}

/**
 * Generate CSS styles.
 */
function generateStyles(): string {
  return `
    <style>
      :root {
        --bg-primary: #0f172a;
        --bg-secondary: #1e293b;
        --bg-tertiary: #334155;
        --text-primary: #f8fafc;
        --text-secondary: #94a3b8;
        --text-muted: #64748b;
        --border-color: #475569;
        --accent-blue: #3b82f6;
        --accent-green: #22c55e;
        --accent-red: #ef4444;
        --accent-yellow: #eab308;
        --accent-orange: #f97316;
      }

      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        background: var(--bg-primary);
        color: var(--text-primary);
        line-height: 1.6;
        padding: 2rem;
      }

      .container {
        max-width: 1400px;
        margin: 0 auto;
      }

      header {
        text-align: center;
        margin-bottom: 3rem;
        padding-bottom: 2rem;
        border-bottom: 1px solid var(--border-color);
      }

      h1 {
        font-size: 2.5rem;
        margin-bottom: 0.5rem;
        background: linear-gradient(135deg, var(--accent-blue), var(--accent-green));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .subtitle {
        color: var(--text-secondary);
        font-size: 1.1rem;
      }

      .meta {
        display: flex;
        justify-content: center;
        gap: 2rem;
        margin-top: 1rem;
        color: var(--text-muted);
        font-size: 0.9rem;
      }

      .section {
        background: var(--bg-secondary);
        border-radius: 12px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
        border: 1px solid var(--border-color);
      }

      .section-title {
        font-size: 1.25rem;
        margin-bottom: 1rem;
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .section-title::before {
        content: '';
        width: 4px;
        height: 1.25rem;
        background: var(--accent-blue);
        border-radius: 2px;
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
      }

      .stat-card {
        background: var(--bg-tertiary);
        padding: 1.25rem;
        border-radius: 8px;
        text-align: center;
      }

      .stat-value {
        font-size: 2rem;
        font-weight: 700;
        color: var(--accent-blue);
      }

      .stat-label {
        font-size: 0.875rem;
        color: var(--text-secondary);
        margin-top: 0.25rem;
      }

      .pass-rate {
        color: var(--accent-green);
      }

      .badge {
        display: inline-block;
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
      }

      .badge-pass { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
      .badge-fail { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
      .badge-error { background: rgba(249, 115, 22, 0.2); color: #f97316; }
      .badge-flaky { background: rgba(234, 179, 8, 0.2); color: #eab308; }

      .table-container {
        overflow-x: auto;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
      }

      th, td {
        padding: 0.75rem 1rem;
        text-align: left;
        border-bottom: 1px solid var(--border-color);
      }

      th {
        background: var(--bg-tertiary);
        font-weight: 600;
        color: var(--text-secondary);
        text-transform: uppercase;
        font-size: 0.75rem;
        letter-spacing: 0.05em;
      }

      tr:hover {
        background: rgba(59, 130, 246, 0.05);
      }

      .progress-bar {
        background: var(--bg-tertiary);
        border-radius: 4px;
        height: 8px;
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        border-radius: 4px;
        transition: width 0.3s ease;
      }

      .findings-list {
        list-style: none;
      }

      .findings-list li {
        padding: 0.75rem 1rem;
        background: var(--bg-tertiary);
        border-radius: 6px;
        margin-bottom: 0.5rem;
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
      }

      .findings-list li::before {
        content: '•';
        color: var(--accent-blue);
        font-weight: bold;
        font-size: 1.25rem;
        line-height: 1;
      }

      .recommendation-card {
        background: var(--bg-tertiary);
        border-radius: 8px;
        padding: 1rem 1.25rem;
        margin-bottom: 0.75rem;
        border-left: 4px solid var(--accent-blue);
      }

      .recommendation-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
      }

      .recommendation-area {
        font-weight: 600;
        color: var(--text-primary);
      }

      .recommendation-text {
        color: var(--text-secondary);
        margin-bottom: 0.5rem;
      }

      .recommendation-rationale {
        font-size: 0.85rem;
        color: var(--text-muted);
        font-style: italic;
      }

      .category-card {
        background: var(--bg-tertiary);
        border-radius: 8px;
        padding: 1.25rem;
        margin-bottom: 1rem;
      }

      .category-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
      }

      .category-name {
        font-weight: 600;
        font-size: 1.1rem;
      }

      .category-summary {
        color: var(--text-secondary);
        margin-bottom: 1rem;
      }

      .category-lists {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1rem;
      }

      .category-list-section h4 {
        color: var(--text-secondary);
        font-size: 0.85rem;
        margin-bottom: 0.5rem;
        text-transform: uppercase;
      }

      .category-list-section ul {
        list-style: disc;
        padding-left: 1.25rem;
        color: var(--text-secondary);
        font-size: 0.9rem;
      }

      .category-list-section li {
        margin-bottom: 0.25rem;
      }

      .risk-indicator {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 1rem 1.5rem;
        background: var(--bg-tertiary);
        border-radius: 8px;
        margin-bottom: 1rem;
      }

      .risk-indicator .label {
        font-weight: 600;
      }

      .action-item {
        background: var(--bg-tertiary);
        border-radius: 8px;
        padding: 1rem 1.25rem;
        margin-bottom: 0.75rem;
      }

      .action-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
      }

      .action-id {
        font-family: monospace;
        color: var(--accent-blue);
        font-size: 0.85rem;
      }

      .action-title {
        font-weight: 600;
      }

      .action-description {
        color: var(--text-secondary);
        font-size: 0.9rem;
      }

      .action-meta {
        display: flex;
        gap: 1rem;
        margin-top: 0.5rem;
        font-size: 0.8rem;
        color: var(--text-muted);
      }

      .executive-summary {
        white-space: pre-wrap;
        line-height: 1.8;
        color: var(--text-secondary);
      }

      footer {
        text-align: center;
        margin-top: 3rem;
        padding-top: 2rem;
        border-top: 1px solid var(--border-color);
        color: var(--text-muted);
        font-size: 0.85rem;
      }

      .collapsible {
        cursor: pointer;
      }

      .collapsible-content {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease;
      }

      .collapsible.open .collapsible-content {
        max-height: 2000px;
      }

      .mode-comparison {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 0.5rem;
        margin-top: 0.5rem;
      }

      .mode-stat {
        background: var(--bg-primary);
        padding: 0.5rem 0.75rem;
        border-radius: 4px;
        font-size: 0.85rem;
      }

      .mode-name {
        color: var(--text-muted);
        font-size: 0.75rem;
      }
    </style>
  `;
}

/**
 * Generate overview stats section.
 */
function generateOverviewStats(report: ComprehensiveReport): string {
  const { aggregatedResults } = report;
  const { aggregateStats } = aggregatedResults;

  return `
    <section class="section">
      <h2 class="section-title">Overview</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${aggregateStats.totalCases}</div>
          <div class="stat-label">Total Cases</div>
        </div>
        <div class="stat-card">
          <div class="stat-value pass-rate">${(aggregateStats.overallPassRate * 100).toFixed(1)}%</div>
          <div class="stat-label">Overall Pass Rate</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${aggregatedResults.totalRuns}</div>
          <div class="stat-label">Total Runs</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${aggregatedResults.configurations.length}</div>
          <div class="stat-label">Configurations</div>
        </div>
      </div>
    </section>
  `;
}

/**
 * Generate mode comparison section.
 */
function generateModeComparison(report: ComprehensiveReport): string {
  const { byMode } = report.aggregatedResults.aggregateStats;

  const rows = Object.entries(byMode)
    .map(([mode, stats]) => {
      const passRate = (stats.passRate * 100).toFixed(1);
      return `
        <tr>
          <td>${escapeHtml(mode)}</td>
          <td>
            <div class="progress-bar" style="width: 100px;">
              <div class="progress-fill" style="width: ${passRate}%; background: ${stats.passRate >= 0.8 ? "#22c55e" : stats.passRate >= 0.6 ? "#eab308" : "#ef4444"};"></div>
            </div>
          </td>
          <td>${passRate}%</td>
          <td>${stats.passed}</td>
          <td>${stats.failed}</td>
          <td>${stats.errors}</td>
          <td>${stats.avgDurationMs.toLocaleString()}ms</td>
        </tr>
      `;
    })
    .join("");

  return `
    <section class="section">
      <h2 class="section-title">Results by Mode</h2>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Mode</th>
              <th>Pass Rate</th>
              <th>%</th>
              <th>Passed</th>
              <th>Failed</th>
              <th>Errors</th>
              <th>Avg Duration</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

/**
 * Generate executive summary section.
 */
function generateExecutiveSummary(report: ComprehensiveReport): string {
  return `
    <section class="section">
      <h2 class="section-title">Executive Summary</h2>
      <div class="executive-summary">${escapeHtml(report.geminiAnalysis.executiveSummary)}</div>
    </section>
  `;
}

/**
 * Generate key findings section.
 */
function generateKeyFindings(report: ComprehensiveReport): string {
  const items = report.geminiAnalysis.keyFindings
    .map((finding) => `<li>${escapeHtml(finding)}</li>`)
    .join("");

  return `
    <section class="section">
      <h2 class="section-title">Key Findings</h2>
      <ul class="findings-list">
        ${items}
      </ul>
    </section>
  `;
}

/**
 * Generate recommendations section.
 */
function generateRecommendations(report: ComprehensiveReport): string {
  const cards = report.geminiAnalysis.recommendations
    .toSorted((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.priority] - order[b.priority];
    })
    .map(
      (rec) => `
      <div class="recommendation-card" style="border-left-color: ${getPriorityColor(rec.priority)};">
        <div class="recommendation-header">
          <span class="recommendation-area">${escapeHtml(rec.area)}</span>
          <span class="badge" style="background: ${getPriorityColor(rec.priority)}20; color: ${getPriorityColor(rec.priority)};">
            ${rec.priority} / ${rec.effort} effort
          </span>
        </div>
        <div class="recommendation-text">${escapeHtml(rec.recommendation)}</div>
        <div class="recommendation-rationale">${escapeHtml(rec.rationale)}</div>
      </div>
    `
    )
    .join("");

  return `
    <section class="section">
      <h2 class="section-title">Recommendations</h2>
      ${cards}
    </section>
  `;
}

/**
 * Generate category insights section.
 */
function generateCategoryInsights(report: ComprehensiveReport): string {
  const cards = report.geminiAnalysis.categoryInsights
    .map((cat) => {
      const strengths =
        cat.strengths.length > 0
          ? `<div class="category-list-section">
            <h4>Strengths</h4>
            <ul>${cat.strengths.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
          </div>`
          : "";

      const weaknesses =
        cat.weaknesses.length > 0
          ? `<div class="category-list-section">
            <h4>Weaknesses</h4>
            <ul>${cat.weaknesses.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul>
          </div>`
          : "";

      const suggestions =
        cat.suggestions.length > 0
          ? `<div class="category-list-section">
            <h4>Suggestions</h4>
            <ul>${cat.suggestions.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
          </div>`
          : "";

      return `
        <div class="category-card">
          <div class="category-header">
            <span class="category-name">${escapeHtml(cat.category)}</span>
          </div>
          <div class="category-summary">${escapeHtml(cat.summary)}</div>
          <div class="category-lists">
            ${strengths}
            ${weaknesses}
            ${suggestions}
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <section class="section">
      <h2 class="section-title">Category Insights</h2>
      ${cards}
    </section>
  `;
}

/**
 * Generate risk assessment section.
 */
function generateRiskAssessment(report: ComprehensiveReport): string {
  const { riskAssessment } = report.geminiAnalysis;

  const factors = riskAssessment.riskFactors
    .map(
      (factor) => `
      <div class="action-item">
        <div class="action-header">
          <span class="action-title">${escapeHtml(factor.factor)}</span>
          <span class="badge" style="background: ${getRiskColor(factor.severity)}20; color: ${getRiskColor(factor.severity)};">
            ${factor.severity}
          </span>
        </div>
        <div class="action-description">${escapeHtml(factor.description)}</div>
      </div>
    `
    )
    .join("");

  return `
    <section class="section">
      <h2 class="section-title">Risk Assessment</h2>
      <div class="risk-indicator" style="border-left: 4px solid ${getRiskColor(riskAssessment.overallRisk)};">
        <span class="label">Overall Risk Level:</span>
        <span class="badge" style="background: ${getRiskColor(riskAssessment.overallRisk)}20; color: ${getRiskColor(riskAssessment.overallRisk)};">
          ${riskAssessment.overallRisk.toUpperCase()}
        </span>
      </div>
      ${factors}
    </section>
  `;
}

/**
 * Generate action items section.
 */
function generateActionItems(report: ComprehensiveReport): string {
  const items = report.geminiAnalysis.actionItems
    .toSorted((a, b) => a.priority - b.priority)
    .map(
      (item) => `
      <div class="action-item">
        <div class="action-header">
          <span>
            <span class="action-id">${escapeHtml(item.id)}</span>
            <span class="action-title"> ${escapeHtml(item.title)}</span>
          </span>
          <span class="badge badge-pass">P${item.priority}</span>
        </div>
        <div class="action-description">${escapeHtml(item.description)}</div>
        <div class="action-meta">
          <span>Category: ${escapeHtml(item.category)}</span>
          ${item.relatedCases.length > 0 ? `<span>Cases: ${item.relatedCases.join(", ")}</span>` : ""}
        </div>
      </div>
    `
    )
    .join("");

  return `
    <section class="section">
      <h2 class="section-title">Action Items</h2>
      ${items}
    </section>
  `;
}

/**
 * Generate case analysis table.
 */
function generateCaseAnalysis(report: ComprehensiveReport): string {
  const problematicCases = report.aggregatedResults.caseAnalysis.filter(
    (c) => c.consistency !== "stable-pass"
  );

  if (problematicCases.length === 0) {
    return `
      <section class="section">
        <h2 class="section-title">Case Analysis</h2>
        <p style="color: var(--text-secondary);">All cases are passing consistently across all configurations.</p>
      </section>
    `;
  }

  const rows = problematicCases
    .toSorted((a, b) => a.passRate - b.passRate)
    .slice(0, 50)
    .map((c) => {
      const consistencyBadge =
        c.consistency === "flaky"
          ? '<span class="badge badge-flaky">Flaky</span>'
          : '<span class="badge badge-fail">Failing</span>';

      const modeResults = c.results
        .map(
          (r) => `
          <div class="mode-stat">
            <div class="mode-name">${r.mode.split("-")[0]}</div>
            <span class="badge badge-${r.status}">${r.status}</span>
          </div>
        `
        )
        .join("");

      return `
        <tr>
          <td><code>${escapeHtml(c.caseId)}</code></td>
          <td>${escapeHtml(c.title)}</td>
          <td>${escapeHtml(c.category)}</td>
          <td>${consistencyBadge}</td>
          <td>${(c.passRate * 100).toFixed(0)}%</td>
          <td>
            <div class="mode-comparison">${modeResults}</div>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <section class="section">
      <h2 class="section-title">Problematic Cases (${problematicCases.length})</h2>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Case ID</th>
              <th>Title</th>
              <th>Category</th>
              <th>Status</th>
              <th>Pass Rate</th>
              <th>Results by Mode</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

/**
 * Generate full HTML report.
 */
function generateHtmlReport(report: ComprehensiveReport): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CEP Hero Eval Report - ${report.runId}</title>
  ${generateStyles()}
</head>
<body>
  <div class="container">
    <header>
      <h1>CEP Hero Comprehensive Eval Report</h1>
      <p class="subtitle">AI Diagnostic System Evaluation Results</p>
      <div class="meta">
        <span>Run ID: ${escapeHtml(report.runId)}</span>
        <span>Generated: ${new Date(report.timestamp).toLocaleString()}</span>
      </div>
    </header>

    <main>
      ${generateOverviewStats(report)}
      ${generateModeComparison(report)}
      ${generateExecutiveSummary(report)}
      ${generateKeyFindings(report)}
      ${generateRecommendations(report)}
      ${generateRiskAssessment(report)}
      ${generateCategoryInsights(report)}
      ${generateActionItems(report)}
      ${generateCaseAnalysis(report)}
    </main>

    <footer>
      <p>Generated by CEP Hero Comprehensive Eval System</p>
      <p>${new Date().toISOString()}</p>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * Write the comprehensive report to disk.
 */
export async function writeComprehensiveReport(
  report: ComprehensiveReport,
  outputDir: string = DEFAULT_OUTPUT_DIR
): Promise<{ htmlPath: string; jsonPath: string }> {
  await mkdir(outputDir, { recursive: true });

  const baseName = `comprehensive-${report.runId}`;
  const htmlPath = path.join(outputDir, `${baseName}.html`);
  const jsonPath = path.join(outputDir, `${baseName}.json`);

  const htmlContent = generateHtmlReport(report);
  await writeFile(htmlPath, htmlContent, "utf8");

  await writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");

  console.log(`[comprehensive] HTML report: ${htmlPath}`);
  console.log(`[comprehensive] JSON report: ${jsonPath}`);

  return { htmlPath, jsonPath };
}
