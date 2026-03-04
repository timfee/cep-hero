/**
 * Export eval results to CSV for independent expert labeling.
 * Exports ALL case reports from a run so the domain expert can independently
 * judge each response as pass/fail without anchoring to the pipeline's verdict.
 *
 * Usage: bun evals/scripts/judge-labels.ts [--run-id RUN_ID]
 */

import { readdirSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const REPORTS_DIR = path.join(process.cwd(), "evals", "reports");
const OUTPUT_PATH = path.join(process.cwd(), "evals", "judge-labels.csv");

interface StoredReport {
  caseId: string;
  title: string;
  responseText: string;
  evidenceResult: {
    passed: boolean;
    message: string;
  };
  status: string;
}

/**
 * Find the most recent run ID or use the one specified via --run-id.
 */
function resolveRunId(): string {
  const args = process.argv.slice(2);
  const runIdIdx = args.indexOf("--run-id");
  if (runIdIdx >= 0 && args[runIdIdx + 1]) {
    return args[runIdIdx + 1];
  }

  const summaries = readdirSync(REPORTS_DIR)
    .filter((f) => f.startsWith("summary-") && f.endsWith(".json"))
    .toSorted();

  if (summaries.length === 0) {
    console.error("No eval reports found");
    process.exit(1);
  }

  return summaries.at(-1)!.replace("summary-", "").replace(".json", "");
}

/**
 * Escape a value for CSV (double-quote strings containing commas/newlines/quotes).
 */
function csvEscape(value: string): string {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

// --- Main ---

const runId = resolveRunId();
console.log(`[judge-labels] Scanning run: ${runId}`);

const suffix = `-${runId}.json`;
const rows: string[] = [];

rows.push(
  [
    "case_id",
    "eval_status",
    "evidence_status",
    "response_preview",
    "required_evidence",
    "expert_verdict",
    "expert_notes",
  ].join(",")
);

let found = 0;

for (const file of readdirSync(REPORTS_DIR).toSorted()) {
  if (file.startsWith("summary-") || file.startsWith("comprehensive-")) {
    continue;
  }
  if (!file.endsWith(suffix)) {
    continue;
  }

  const content = readFileSync(path.join(REPORTS_DIR, file), "utf8");
  const report = JSON.parse(content) as StoredReport;
  found += 1;

  const preview = report.responseText
    .replaceAll(/\s+/g, " ")
    .slice(0, 400)
    .trim();

  const evidenceStatus = report.evidenceResult?.passed ? "pass" : "fail";

  rows.push(
    [
      csvEscape(report.caseId),
      csvEscape(report.status),
      csvEscape(evidenceStatus),
      csvEscape(preview),
      csvEscape(report.evidenceResult?.message ?? "N/A"),
      "",
      "",
    ].join(",")
  );
}

const csv = `${rows.join("\n")}\n`;
await writeFile(OUTPUT_PATH, csv, "utf8");

console.log(
  `[judge-labels] Exported ${found} cases from run ${runId} to ${OUTPUT_PATH}`
);
console.log(
  `[judge-labels] Fill in "expert_verdict" (pass/fail) and "expert_notes", then run judge-validate.ts`
);
