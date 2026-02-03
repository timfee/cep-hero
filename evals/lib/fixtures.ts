/**
 * Fixture loading utilities for evals.
 * Handles loading base fixtures and case-specific overrides.
 */

/* eslint-disable import/no-nodejs-modules */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { type FixtureData } from "@/lib/mcp/types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function loadJsonFile(filePath: string): unknown {
  const contents = readFileSync(filePath, "utf8");
  return JSON.parse(contents) as unknown;
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

export interface LoadFixturesOptions {
  useBase?: boolean;
  useFixtures?: boolean;
  rootDir?: string;
}

/**
 * Load fixture data for an eval case.
 * Merges base fixtures with case-specific overrides.
 */
export function loadEvalFixtures(
  caseId: string,
  options: LoadFixturesOptions = {}
): FixtureData | undefined {
  const {
    useBase = process.env.EVAL_USE_BASE === "1",
    useFixtures = process.env.EVAL_USE_FIXTURES === "1",
    rootDir = process.cwd(),
  } = options;

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
      const loaded = loadJsonFile(basePath);
      baseData = isPlainObject(loaded) ? loaded : {};
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
    const loaded = loadJsonFile(caseOverridePath);
    overrideData = isPlainObject(loaded) ? loaded : {};
  }

  const merged = mergeJson(baseData, overrideData);
  const mergedObject = isPlainObject(merged) ? merged : {};

  return {
    orgUnits: Array.isArray(mergedObject.orgUnits)
      ? mergedObject.orgUnits
      : undefined,
    auditEvents: isPlainObject(mergedObject.auditEvents)
      ? (mergedObject.auditEvents as FixtureData["auditEvents"])
      : undefined,
    dlpRules: Array.isArray(mergedObject.dlpRules)
      ? mergedObject.dlpRules
      : undefined,
    connectorPolicies: Array.isArray(mergedObject.connectorPolicies)
      ? mergedObject.connectorPolicies
      : undefined,
    policySchemas: Array.isArray(mergedObject.policySchemas)
      ? mergedObject.policySchemas
      : undefined,
    chromeReports: isPlainObject(mergedObject.chromeReports)
      ? mergedObject.chromeReports
      : undefined,
    errors: isPlainObject(mergedObject.errors)
      ? (mergedObject.errors as FixtureData["errors"])
      : undefined,
  };
}

/**
 * Build an eval prompt with optional fixture context attached.
 */
export function buildEvalPrompt(
  basePrompt: string,
  options: {
    fixtures?: string[];
    overrides?: string[];
    caseId?: string;
    rootDir?: string;
    useBase?: boolean;
    useFixtures?: boolean;
    injectIntoPrompt?: boolean;
  } = {}
): string {
  const base = `${basePrompt}\n\nPlease respond with diagnosis, evidence, hypotheses, and next steps. Keep the response under 800 characters and avoid long nested fields.`;

  const {
    fixtures,
    overrides,
    caseId,
    rootDir = process.cwd(),
    useBase = process.env.EVAL_USE_BASE === "1",
    useFixtures = process.env.EVAL_USE_FIXTURES === "1",
    // NEW: Control whether to inject fixtures into prompt (default: false for realistic testing)
    injectIntoPrompt = process.env.EVAL_INJECT_PROMPT === "1",
  } = options;

  // If not injecting into prompt, return base prompt only
  if (!injectIntoPrompt) {
    return base;
  }

  if (!useFixtures && !useBase && (!overrides || overrides.length === 0)) {
    return base;
  }

  const blocks: string[] = [];
  const overridePaths: string[] = [];

  if (overrides) {
    for (const overridePath of overrides) {
      overridePaths.push(
        path.isAbsolute(overridePath)
          ? overridePath
          : path.join(rootDir, overridePath)
      );
    }
  }

  if (isNonEmptyString(caseId)) {
    const perCaseOverridePath = path.join(
      rootDir,
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
      rootDir,
      "evals",
      "fixtures",
      "base",
      "api-base.json"
    );
    let baseData: unknown = loadJsonFile(basePath);
    if (overridePaths.length > 0) {
      for (const overridePath of overridePaths) {
        const overrideData = loadJsonFile(overridePath);
        baseData = mergeJson(baseData, overrideData);
      }
      blocks.push(formatJsonBlock("api-base+overrides.json", baseData));
    } else {
      blocks.push(formatFileBlock("api-base.json", basePath));
    }
  } else if (overridePaths.length > 0) {
    for (const overridePath of overridePaths) {
      blocks.push(formatFileBlock(path.basename(overridePath), overridePath));
    }
  }

  if (useFixtures && fixtures && fixtures.length > 0) {
    for (const fixturePath of fixtures) {
      const fullPath = path.isAbsolute(fixturePath)
        ? fixturePath
        : path.join(rootDir, fixturePath);
      blocks.push(formatFileBlock(path.basename(fixturePath), fullPath));
    }
  }

  if (blocks.length === 0) {
    return base;
  }

  return `${base}\n\nFixture context:\n${blocks.join("\n\n")}`;
}

function formatFileBlock(label: string, filePath: string): string {
  const contents = readFileSync(filePath, "utf8");
  return `--- ${label} ---\n${contents}`;
}

function formatJsonBlock(label: string, data: unknown): string {
  return `--- ${label} ---\n${JSON.stringify(data, null, 2)}`;
}
