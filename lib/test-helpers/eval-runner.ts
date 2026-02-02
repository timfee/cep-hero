import { expect } from "bun:test";
import { existsSync, readFileSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import type { FixtureData } from "@/lib/mcp/types";

/** Pass/fail status for eval reports. */
export type EvalReportStatus = "pass" | "fail";

/** Report payload emitted per eval run. */
export type EvalReport = {
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
  schemaMatched: boolean;
  rubricScore?: number;
  rubricCriteria?: string[];
  rubricMinScore?: number;
  status: EvalReportStatus;
  durationMs: number;
  timestamp: string;
  error?: string;
};

const schemaKeyMap: Record<string, string> = {
  diagnosis: "diagnosis",
  evidence: "evidence",
  hypotheses: "hypotheses",
  next_steps: "nextSteps",
  reference: "reference",
};

const DEFAULT_REPORTS_DIR = path.join(process.cwd(), "evals", "reports");

type BuildEvalPromptOptions = {
  fixtures?: string[];
  overrides?: string[];
  caseId?: string;
  rootDir?: string;
};

/**
 * Build an eval prompt and optionally attach fixture context when enabled.
 */
export function buildEvalPrompt(
  basePrompt: string,
  fixtures?: string[],
  rootDir?: string,
  overrides?: string[]
): string;
export function buildEvalPrompt(
  basePrompt: string,
  options?: BuildEvalPromptOptions
): string;
export function buildEvalPrompt(
  basePrompt: string,
  fixturesOrOptions: string[] | BuildEvalPromptOptions = [],
  rootDir: string = process.cwd(),
  overrides?: string[]
): string {
  const base = `${basePrompt}\n\nPlease respond with diagnosis, evidence, hypotheses, and next steps. Keep the response under 800 characters and avoid long nested fields.`;
  const options = Array.isArray(fixturesOrOptions)
    ? ({
        fixtures: fixturesOrOptions,
        overrides,
        rootDir,
      } satisfies BuildEvalPromptOptions)
    : fixturesOrOptions;
  const {
    fixtures,
    overrides: optionOverrides,
    caseId,
    rootDir: resolvedRootDir = process.cwd(),
  } = options ?? {};
  const useFixtures = process.env.EVAL_USE_FIXTURES === "1";
  const useBase = process.env.EVAL_USE_BASE === "1";
  const resolvedOverrides = optionOverrides ?? overrides;
  if (
    !useFixtures &&
    !useBase &&
    (!resolvedOverrides || resolvedOverrides.length === 0)
  ) {
    return base;
  }

  const blocks: string[] = [];
  const overridePaths: string[] = [];
  if (resolvedOverrides) {
    for (const overridePath of resolvedOverrides) {
      overridePaths.push(
        path.isAbsolute(overridePath)
          ? overridePath
          : path.join(resolvedRootDir, overridePath)
      );
    }
  }
  if (caseId) {
    const perCaseOverridePath = path.join(
      resolvedRootDir,
      "evals",
      "fixtures",
      caseId,
      "overrides.json"
    );
    if (existsSync(perCaseOverridePath)) {
      overridePaths.push(perCaseOverridePath);
    }
  }

  if (useBase) {
    const basePath = path.join(
      resolvedRootDir,
      "evals",
      "fixtures",
      "base",
      "api-base.json"
    );
    let baseData: unknown = loadJsonFixture(basePath);
    if (overridePaths.length > 0) {
      for (const overridePath of overridePaths) {
        const overrideData = loadJsonFixture(overridePath);
        baseData = mergeJson(baseData, overrideData);
      }
      blocks.push(formatJsonFixture("api-base+overrides.json", baseData));
    } else {
      blocks.push(formatFixture("api-base.json", basePath));
    }
  } else if (overridePaths.length > 0) {
    for (const overridePath of overridePaths) {
      blocks.push(formatFixture(path.basename(overridePath), overridePath));
    }
  }

  if (useFixtures && fixtures && fixtures.length > 0) {
    for (const fixturePath of fixtures) {
      const fullPath = path.isAbsolute(fixturePath)
        ? fixturePath
        : path.join(resolvedRootDir, fixturePath);
      blocks.push(formatFixture(path.basename(fixturePath), fullPath));
    }
  }

  if (blocks.length === 0) {
    return base;
  }

  return `${base}\n\nFixture context:\n${blocks.join("\n\n")}`;
}

function formatFixture(label: string, filePath: string): string {
  const contents = readFileSync(filePath, "utf-8");
  return `--- ${label} ---\n${contents}`;
}

function loadJsonFixture(filePath: string): unknown {
  const contents = readFileSync(filePath, "utf-8");
  return JSON.parse(contents) as unknown;
}

function formatJsonFixture(label: string, data: unknown): string {
  return `--- ${label} ---\n${JSON.stringify(data, null, 2)}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeJson(base: unknown, override: unknown): unknown {
  if (override === undefined) {
    return base;
  }
  if (base === undefined) {
    return override;
  }
  if (isPlainObject(base) && isPlainObject(override)) {
    const result: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(override)) {
      result[key] = mergeJson(result[key], value);
    }
    return result;
  }
  return override;
}

/**
 * Enforce evidence markers when strict evidence gating is enabled.
 */
export function assertRequiredEvidence({
  text,
  metadata,
  requiredEvidence,
}: {
  text: string;
  metadata: unknown;
  requiredEvidence: string[] | undefined;
}): void {
  if (!requiredEvidence || requiredEvidence.length === 0) {
    return;
  }
  const lowerText = text.toLowerCase();
  const metadataText = metadata ? JSON.stringify(metadata).toLowerCase() : "";
  const combined = `${lowerText}\n${metadataText}`;
  const missing = requiredEvidence.filter(
    (needle) => !combined.includes(needle.toLowerCase())
  );
  if (missing.length === 0) {
    return;
  }
  if (process.env.EVAL_STRICT_EVIDENCE === "1") {
    throw new Error(`Missing required evidence: ${missing.join(", ")}`);
  }
  if (process.env.EVAL_WARN_MISSING_EVIDENCE === "1") {
    console.warn(`[eval] Missing required evidence: ${missing.join(", ")}`);
  }
}

/**
 * Validate that a response contains the expected structured output.
 * Returns true when schema metadata is present.
 */
export function assertStructuredResponse({
  text,
  metadata,
  expectedSchema,
}: {
  text: string;
  metadata: unknown;
  expectedSchema: string[];
}): boolean {
  const schemaMatched = hasExpectedSchema(metadata, expectedSchema);
  if (schemaMatched) {
    return true;
  }

  expectStructuredText(text, expectedSchema);
  return false;
}

/**
 * Score rubric criteria by checking for required cues in the response.
 */
export function scoreRubric({
  text,
  metadata,
  criteria,
}: {
  text: string;
  metadata: unknown;
  criteria: string[];
}): number {
  const combined = `${text.toLowerCase()}\n${metadata ? JSON.stringify(metadata).toLowerCase() : ""}`;
  return criteria.reduce((score, criterion) => {
    return combined.includes(criterion.toLowerCase()) ? score + 1 : score;
  }, 0);
}

/**
 * Enforce rubric threshold when strict rubric gating is enabled.
 */
export function enforceRubric({
  score,
  minScore,
}: {
  score: number;
  minScore: number;
}): void {
  if (score >= minScore) {
    return;
  }
  if (process.env.EVAL_RUBRIC_STRICT === "1") {
    throw new Error(`Rubric score ${score} below minimum ${minScore}.`);
  }
  if (process.env.EVAL_WARN_RUBRIC === "1") {
    console.warn(`[eval] Rubric score ${score} below minimum ${minScore}.`);
  }
}

/** Persist a report to evals/reports with a stable filename. */
export async function writeEvalReport(
  report: EvalReport,
  reportsDir: string = DEFAULT_REPORTS_DIR
): Promise<string> {
  await mkdir(reportsDir, { recursive: true });
  const fileName = `${report.caseId}-${report.runId}.json`;
  const outputPath = path.join(reportsDir, fileName);
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
  return outputPath;
}

export function createRunId(date: Date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

function hasExpectedSchema(metadata: unknown, expected: string[]): boolean {
  if (!isRecord(metadata)) return false;
  return expected.every((key) => {
    const mapped = schemaKeyMap[key] ?? key;
    return Object.prototype.hasOwnProperty.call(metadata, mapped);
  });
}

function expectStructuredText(text: string, expected: string[]): void {
  const lower = text.toLowerCase();
  const signals = ["diagnosis", "evidence", "hypothesis", "next", "reference"];
  const matches = signals.filter((signal) => lower.includes(signal)).length;
  if (expected.length === 0) {
    expect(lower.length).toBeGreaterThan(0);
    return;
  }
  expect(lower.length).toBeGreaterThan(20);
  expect(matches).toBeGreaterThanOrEqual(1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Load fixture data for an eval case.
 * Merges base fixtures with case-specific overrides.
 */
export function loadEvalFixtures(
  caseId: string,
  rootDir: string = process.cwd()
): FixtureData | undefined {
  const useBase = process.env.EVAL_USE_BASE === "1";
  const useFixtures = process.env.EVAL_USE_FIXTURES === "1";

  if (!useBase && !useFixtures) {
    return undefined;
  }

  let baseData: Record<string, unknown> = {};

  if (useBase) {
    const basePath = path.join(
      rootDir,
      "evals",
      "fixtures",
      "base",
      "api-base.json"
    );
    if (existsSync(basePath)) {
      baseData = loadJsonFixture(basePath) as Record<string, unknown>;
    }
  }

  const caseOverridePath = path.join(
    rootDir,
    "evals",
    "fixtures",
    caseId,
    "overrides.json"
  );
  let overrideData: Record<string, unknown> = {};

  if (existsSync(caseOverridePath)) {
    overrideData = loadJsonFixture(caseOverridePath) as Record<string, unknown>;
  }

  const merged = mergeJson(baseData, overrideData) as Record<string, unknown>;

  return {
    orgUnits: Array.isArray(merged.orgUnits) ? merged.orgUnits : undefined,
    auditEvents: isPlainObject(merged.auditEvents)
      ? (merged.auditEvents as FixtureData["auditEvents"])
      : undefined,
    dlpRules: Array.isArray(merged.dlpRules) ? merged.dlpRules : undefined,
    connectorPolicies: Array.isArray(merged.connectorPolicies)
      ? merged.connectorPolicies
      : undefined,
    policySchemas: Array.isArray(merged.policySchemas)
      ? merged.policySchemas
      : undefined,
    chromeReports: isPlainObject(merged.chromeReports)
      ? (merged.chromeReports as Record<string, unknown>)
      : undefined,
    errors: isPlainObject(merged.errors)
      ? (merged.errors as FixtureData["errors"])
      : undefined,
  };
}
