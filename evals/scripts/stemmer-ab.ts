/**
 * A/B comparison of evidence matching with and without Porter stemming.
 * Re-evaluates stored response text from the latest eval run — no LLM calls needed.
 *
 * Usage: bun evals/scripts/stemmer-ab.ts
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  checkForbiddenEvidence,
  checkRequiredEvidence,
} from "../lib/assertions";
import { normalizeForMatchingStemmed } from "../lib/utils";

const REPORTS_DIR = path.join(process.cwd(), "evals", "reports");
const REGISTRY_PATH = path.join(process.cwd(), "evals", "registry.json");

interface StoredReport {
  caseId: string;
  responseText: string;
  responseMetadata: unknown;
  status: string;
}

interface CaseSpec {
  id: string;
  required_evidence?: string[];
  forbidden_evidence?: string[];
}

/**
 * Find the most recent run ID from summary files.
 */
function findLatestRunId(): string | undefined {
  const summaries = readdirSync(REPORTS_DIR)
    .filter((f) => f.startsWith("summary-") && f.endsWith(".json"))
    .toSorted();
  if (summaries.length === 0) {
    return undefined;
  }
  const latest = summaries.at(-1)!;
  return latest.replace("summary-", "").replace(".json", "");
}

/**
 * Load all case reports for a given run ID.
 */
function loadReports(runId: string): Map<string, StoredReport> {
  const reports = new Map<string, StoredReport>();
  const suffix = `-${runId}.json`;

  for (const file of readdirSync(REPORTS_DIR)) {
    if (file.startsWith("summary-") || file.startsWith("comprehensive-")) {
      continue;
    }
    if (!file.endsWith(suffix)) {
      continue;
    }
    try {
      const content = readFileSync(path.join(REPORTS_DIR, file), "utf8");
      const report = JSON.parse(content) as StoredReport;
      reports.set(report.caseId, report);
    } catch {
      // Skip
    }
  }
  return reports;
}

/**
 * Run evidence check using the stemmed normalizer by monkey-patching.
 * We override the module's normalizeForMatching temporarily.
 */
function checkEvidenceStemmed(
  text: string,
  metadata: unknown,
  evidence: string[]
): boolean {
  const combined = normalizeForMatchingStemmed(
    `${text}\n${metadata ? JSON.stringify(metadata) : ""}`
  );
  return evidence.every((needle) =>
    combined.includes(normalizeForMatchingStemmed(needle))
  );
}

function checkForbiddenStemmed(
  text: string,
  metadata: unknown,
  forbidden: string[]
): boolean {
  const combined = normalizeForMatchingStemmed(
    `${text}\n${metadata ? JSON.stringify(metadata) : ""}`
  );
  const found = forbidden.filter((needle) =>
    combined.includes(normalizeForMatchingStemmed(needle))
  );
  return found.length === 0;
}

// --- Main ---

const runId = findLatestRunId();
if (!runId) {
  console.error("No eval reports found in", REPORTS_DIR);
  process.exit(1);
}

console.log(`[stemmer-ab] Using run: ${runId}`);

const reports = loadReports(runId);
const registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf8")) as {
  cases: CaseSpec[];
};

console.log(`[stemmer-ab] Loaded ${reports.size} reports\n`);

const header = [
  "Case ID".padEnd(12),
  "Type".padEnd(12),
  "Without".padEnd(10),
  "With".padEnd(10),
  "Changed?",
].join(" | ");
console.log(header);
console.log("-".repeat(header.length));

let changedCount = 0;
let totalChecked = 0;

for (const spec of registry.cases) {
  const report = reports.get(spec.id);
  if (!report) {
    continue;
  }

  if (spec.required_evidence?.length) {
    totalChecked += 1;
    const withoutResult = checkRequiredEvidence({
      text: report.responseText,
      metadata: report.responseMetadata,
      requiredEvidence: spec.required_evidence,
    });
    const withResult = checkEvidenceStemmed(
      report.responseText,
      report.responseMetadata,
      spec.required_evidence
    );

    const changed = withoutResult.passed !== withResult;
    if (changed) {
      changedCount += 1;
    }

    console.log(
      [
        spec.id.padEnd(12),
        "evidence".padEnd(12),
        (withoutResult.passed ? "PASS" : "FAIL").padEnd(10),
        (withResult ? "PASS" : "FAIL").padEnd(10),
        changed ? "<-- CHANGED" : "",
      ].join(" | ")
    );
  }

  if (spec.forbidden_evidence?.length) {
    totalChecked += 1;
    const withoutResult = checkForbiddenEvidence({
      text: report.responseText,
      metadata: report.responseMetadata,
      forbiddenEvidence: spec.forbidden_evidence,
    });
    const withResult = checkForbiddenStemmed(
      report.responseText,
      report.responseMetadata,
      spec.forbidden_evidence
    );

    const changed = withoutResult.passed !== withResult;
    if (changed) {
      changedCount += 1;
    }

    console.log(
      [
        spec.id.padEnd(12),
        "forbidden".padEnd(12),
        (withoutResult.passed ? "PASS" : "FAIL").padEnd(10),
        (withResult ? "PASS" : "FAIL").padEnd(10),
        changed ? "<-- CHANGED" : "",
      ].join(" | ")
    );
  }
}

console.log("");
console.log(`[stemmer-ab] ${totalChecked} checks, ${changedCount} changed`);
