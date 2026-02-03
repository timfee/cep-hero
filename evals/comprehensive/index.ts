#!/usr/bin/env bun
/**
 * Comprehensive eval runner with beautiful human-readable output.
 */

import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { z } from "zod";

const REPORTS_DIR = "evals/reports";
const OUTPUT_DIR = "evals/comprehensive/reports";

interface Summary {
  runId: string;
  passed: number;
  failed: number;
  total: number;
  durationMs: number;
  byCategory: Record<string, { passed: number; failed: number; total: number }>;
  failures: { id: string; title: string; reason: string }[];
}

// Parse CLI args
const args = process.argv.slice(2);
const showHelp = args.includes("--help") || args.includes("-h");
const withJudge = args.includes("--with-judge");
const skipAnalysis = args.includes("--skip-analysis");
const iterationsArg = args.find((_, i) => args[i - 1] === "--iterations");
const iterations = iterationsArg ? Number.parseInt(iterationsArg, 10) : 1;
const casesArg = args.find((_, i) => args[i - 1] === "--cases");

if (showHelp) {
  console.log(`
Usage: bun evals/comprehensive/index.ts [options]

Options:
  --with-judge      Enable LLM judge
  --iterations N    Run N times (default: 1)
  --skip-analysis   Skip Gemini analysis
  --cases IDS       Filter cases
  --help            Show help
`);
  process.exit(0);
}

// Run evals
async function runEvals(): Promise<Summary | null> {
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    EVAL_USE_BASE: "1",
    EVAL_SERIAL: "1",
    EVAL_LLM_JUDGE: withJudge ? "1" : "0",
  };
  if (casesArg) {env.EVAL_IDS = casesArg;}

  const proc = Bun.spawn(["bun", "run", "evals"], {
    env,
    stdout: "inherit",
    stderr: "inherit",
  });

  await proc.exited;

  // Find latest summary
  const files = await readdir(REPORTS_DIR);
  const latest = files
    .filter((f) => f.startsWith("summary-"))
    .toSorted()
    .pop();

  if (!latest) {return null;}

  const content = await readFile(`${REPORTS_DIR}/${latest}`, "utf8");
  return JSON.parse(content) as Summary;
}

// Collect multiple runs
const allSummaries: Summary[] = [];
console.log("\n" + "═".repeat(60));
console.log("  COMPREHENSIVE EVAL");
console.log("═".repeat(60));
console.log(`  Iterations: ${iterations}`);
console.log(`  LLM Judge: ${withJudge ? "enabled" : "disabled"}`);
console.log("═".repeat(60) + "\n");

for (let i = 0; i < iterations; i++) {
  if (iterations > 1) {console.log(`\n── Run ${i + 1}/${iterations} ──\n`);}
  const summary = await runEvals();
  if (summary) {allSummaries.push(summary);}
}

if (allSummaries.length === 0) {
  console.error("\n❌ No results collected\n");
  process.exit(1);
}

// Aggregate
const totals = {
  passed: allSummaries.reduce((s, r) => s + r.passed, 0),
  failed: allSummaries.reduce((s, r) => s + r.failed, 0),
  total: allSummaries.reduce((s, r) => s + r.total, 0),
  durationMs: allSummaries.reduce((s, r) => s + r.durationMs, 0),
};
const passRate = totals.total > 0 ? (totals.passed / totals.total) * 100 : 0;

// Aggregate categories
const categories: Record<
  string,
  { passed: number; failed: number; total: number }
> = {};
for (const s of allSummaries) {
  for (const [cat, data] of Object.entries(s.byCategory)) {
    categories[cat] ??= { passed: 0, failed: 0, total: 0 };
    categories[cat].passed += data.passed;
    categories[cat].failed += data.failed;
    categories[cat].total += data.total;
  }
}

// Collect unique failures
const failureMap = new Map<
  string,
  { id: string; title: string; reason: string }
>();
for (const s of allSummaries) {
  for (const f of s.failures) {
    failureMap.set(f.id, f);
  }
}
const failures = [...failureMap.values()];

// Print beautiful summary
console.log("\n");
console.log("╔" + "═".repeat(58) + "╗");
console.log("║" + " ".repeat(20) + "RESULTS SUMMARY" + " ".repeat(23) + "║");
console.log("╠" + "═".repeat(58) + "╣");
console.log(
  `║  Total Cases:    ${String(totals.total).padStart(6)}                                 ║`
);
console.log(
  `║  Passed:         ${String(totals.passed).padStart(6)}  ${"█".repeat(Math.round(passRate / 5))}${"░".repeat(20 - Math.round(passRate / 5))}  ║`
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
console.log("╠" + "═".repeat(58) + "╣");
console.log("║  BY CATEGORY                                             ║");
console.log("╟" + "─".repeat(58) + "╢");

for (const [cat, data] of Object.entries(categories).toSorted()) {
  const catRate = data.total > 0 ? (data.passed / data.total) * 100 : 0;
  const bar =
    "█".repeat(Math.round(catRate / 10)) +
    "░".repeat(10 - Math.round(catRate / 10));
  console.log(
    `║  ${cat.padEnd(15)} ${String(data.passed).padStart(3)}/${String(data.total).padStart(3)}  ${bar}  ${catRate.toFixed(0).padStart(3)}%  ║`
  );
}

if (failures.length > 0) {
  console.log("╠" + "═".repeat(58) + "╣");
  console.log("║  FAILURES                                                ║");
  console.log("╟" + "─".repeat(58) + "╢");
  for (const f of failures.slice(0, 10)) {
    const title = f.title.length > 40 ? f.title.slice(0, 37) + "..." : f.title;
    console.log(`║  ${f.id.padEnd(8)} ${title.padEnd(42)}  ║`);
  }
  if (failures.length > 10) {
    console.log(
      `║  ... and ${failures.length - 10} more                                       ║`
    );
  }
}

console.log("╚" + "═".repeat(58) + "╝");

// Gemini analysis
if (!skipAnalysis) {
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

    console.log("╔" + "═".repeat(58) + "╗");
    console.log(
      "║" + " ".repeat(18) + "GEMINI 2.5 PRO ANALYSIS" + " ".repeat(17) + "║"
    );
    console.log("╠" + "═".repeat(58) + "╣");

    // Word wrap summary
    const words = analysis.summary.split(" ");
    let line = "║  ";
    for (const word of words) {
      if (line.length + word.length > 56) {
        console.log(line.padEnd(59) + "║");
        line = "║  " + word + " ";
      } else {
        line += word + " ";
      }
    }
    if (line.length > 4) {console.log(line.padEnd(59) + "║");}

    console.log("╟" + "─".repeat(58) + "╢");
    console.log("║  KEY INSIGHTS                                            ║");
    for (const insight of analysis.insights) {
      const short =
        insight.length > 52 ? insight.slice(0, 49) + "..." : insight;
      console.log(`║  • ${short.padEnd(53)} ║`);
    }

    console.log("╟" + "─".repeat(58) + "╢");
    console.log("║  RECOMMENDATIONS                                         ║");
    for (const rec of analysis.recommendations) {
      const short = rec.length > 52 ? rec.slice(0, 49) + "..." : rec;
      console.log(`║  → ${short.padEnd(53)} ║`);
    }

    console.log("╚" + "═".repeat(58) + "╝");
  } catch (error) {
    console.log(
      "⚠️  Gemini analysis failed:",
      error instanceof Error ? error.message : error
    );
  }
}

// Save JSON report
await mkdir(OUTPUT_DIR, { recursive: true });
const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
const report = { timestamp, totals, categories, failures, passRate };
await writeFile(
  `${OUTPUT_DIR}/report-${timestamp}.json`,
  JSON.stringify(report, null, 2)
);

// Generate HTML report
const html = `<!DOCTYPE html>
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
    ${Object.entries(categories)
      .toSorted()
      .map(([cat, d]) => {
        const rate = d.total > 0 ? (d.passed / d.total) * 100 : 0;
        return `<tr><td>${cat}</td><td class="pass">${d.passed}</td><td class="fail">${d.failed}</td><td>${rate.toFixed(0)}%</td><td><div class="bar"><div class="bar-fill" style="width:${rate}%"></div></div></td></tr>`;
      })
      .join("")}
  </table>

  ${
    failures.length > 0
      ? `
  <h2>Failures</h2>
  <table>
    <tr><th>Case</th><th>Title</th><th>Reason</th></tr>
    ${failures.map((f) => `<tr><td>${f.id}</td><td>${f.title}</td><td style="color:#94a3b8;font-size:0.9rem">${f.reason.slice(0, 60)}...</td></tr>`).join("")}
  </table>
  `
      : ""
  }
</body>
</html>`;

await writeFile(`${OUTPUT_DIR}/report-${timestamp}.html`, html);
console.log(`\n📄 Reports saved to ${OUTPUT_DIR}/`);
console.log(`   • report-${timestamp}.json`);
console.log(`   • report-${timestamp}.html\n`);
