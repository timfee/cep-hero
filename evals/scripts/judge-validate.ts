/**
 * Compute pipeline validation metrics from expert-labeled CSV.
 * Compares the expert's independent pass/fail verdicts against the eval pipeline's verdicts.
 *
 * Computes: agreement rate, precision (of pipeline pass verdicts), recall (of actual good responses).
 *
 * Usage: bun evals/scripts/judge-validate.ts [path-to-csv]
 */

import { readFileSync } from "node:fs";
import path from "node:path";

const DEFAULT_CSV = path.join(process.cwd(), "evals", "judge-labels.csv");

/**
 * Parse CSV with proper quote handling.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

// --- Main ---

const csvPath = process.argv[2] ?? DEFAULT_CSV;
const content = readFileSync(csvPath, "utf8");
const lines = content.trim().split("\n");

if (lines.length < 2) {
  console.error("CSV has no data rows");
  process.exit(1);
}

const header = parseCsvLine(lines[0]);
const evalStatusIdx = header.indexOf("eval_status");
const expertVerdictIdx = header.indexOf("expert_verdict");
const caseIdIdx = header.indexOf("case_id");

if (evalStatusIdx < 0 || expertVerdictIdx < 0) {
  console.error("CSV must have eval_status and expert_verdict columns");
  process.exit(1);
}

let totalLabeled = 0;
let agreements = 0;
let truePositives = 0;
let falsePositives = 0;
let trueNegatives = 0;
let falseNegatives = 0;
const pipelineWrong: string[] = [];

for (let i = 1; i < lines.length; i += 1) {
  const fields = parseCsvLine(lines[i]);
  const evalStatus = fields[evalStatusIdx]?.trim().toLowerCase();
  const expertVerdict = fields[expertVerdictIdx]?.trim().toLowerCase();
  const caseId = fields[caseIdIdx] ?? `row-${i}`;

  if (!expertVerdict) {
    continue;
  }

  totalLabeled += 1;
  const pipelinePass = evalStatus === "pass";
  const expertPass = expertVerdict === "pass";

  if (pipelinePass && expertPass) {
    truePositives += 1;
    agreements += 1;
  } else if (pipelinePass && !expertPass) {
    falsePositives += 1;
    pipelineWrong.push(`${caseId}: pipeline=pass, expert=fail`);
  } else if (!pipelinePass && !expertPass) {
    trueNegatives += 1;
    agreements += 1;
  } else {
    falseNegatives += 1;
    pipelineWrong.push(`${caseId}: pipeline=fail, expert=pass`);
  }
}

if (totalLabeled === 0) {
  console.error(
    "No labeled rows found. Fill in the expert_verdict column first."
  );
  process.exit(1);
}

const agreementRate = ((agreements / totalLabeled) * 100).toFixed(1);
const precision =
  truePositives + falsePositives > 0
    ? ((truePositives / (truePositives + falsePositives)) * 100).toFixed(1)
    : "N/A";
const recall =
  truePositives + falseNegatives > 0
    ? ((truePositives / (truePositives + falseNegatives)) * 100).toFixed(1)
    : "N/A";

console.log("=".repeat(50));
console.log("PIPELINE VALIDATION RESULTS");
console.log("=".repeat(50));
console.log(`Total labeled:     ${totalLabeled}`);
console.log(`Agreement rate:    ${agreementRate}%`);
console.log(`Precision:         ${precision}%`);
console.log(`Recall:            ${recall}%`);
console.log("");
console.log(`True positives:    ${truePositives}`);
console.log(`False positives:   ${falsePositives}`);
console.log(`True negatives:    ${trueNegatives}`);
console.log(`False negatives:   ${falseNegatives}`);

if (pipelineWrong.length > 0) {
  console.log("");
  console.log("Pipeline errors (expert disagrees):");
  for (const d of pipelineWrong) {
    console.log(`  ${d}`);
  }
}

console.log("=".repeat(50));
