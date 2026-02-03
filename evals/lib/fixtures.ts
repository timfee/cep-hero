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

function loadBaseFixtures(
  rootDir: string,
  useBase: boolean
): Record<string, unknown> {
  if (!useBase) {
    return {};
  }
  const basePath = path.join(
    rootDir,
    "evals",
    "fixtures",
    "base",
    "api-base.json"
  );
  if (!existsSync(basePath)) {
    return {};
  }
  const loaded = loadJsonFile(basePath);
  return isPlainObject(loaded) ? loaded : {};
}

function loadCaseOverrides(
  rootDir: string,
  caseId: string
): Record<string, unknown> {
  const caseOverridePath = path.join(
    rootDir,
    "evals",
    "fixtures",
    caseId,
    "overrides.json"
  );
  if (!existsSync(caseOverridePath)) {
    return {};
  }
  const loaded = loadJsonFile(caseOverridePath);
  return isPlainObject(loaded) ? loaded : {};
}

function buildFixtureData(mergedObject: Record<string, unknown>): FixtureData {
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

  const baseData = loadBaseFixtures(rootDir, useBase);
  const overrideData = loadCaseOverrides(rootDir, caseId);
  const merged = mergeJson(baseData, overrideData);
  const mergedObject = isPlainObject(merged) ? merged : {};

  return buildFixtureData(mergedObject);
}

interface PromptBuildOptions {
  fixtures?: string[];
  overrides?: string[];
  caseId?: string;
  rootDir?: string;
  useBase?: boolean;
  useFixtures?: boolean;
  injectIntoPrompt?: boolean;
}

function resolvePath(filePath: string, rootDir: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath);
}

function collectOverridePaths(
  overrides: string[] | undefined,
  caseId: string | undefined,
  rootDir: string
): string[] {
  const paths: string[] = [];
  if (overrides) {
    for (const overridePath of overrides) {
      paths.push(resolvePath(overridePath, rootDir));
    }
  }
  if (isNonEmptyString(caseId)) {
    const perCasePath = path.join(
      rootDir,
      "evals",
      "fixtures",
      caseId,
      "overrides.json"
    );
    if (existsSync(perCasePath)) {
      paths.push(perCasePath);
    }
  }
  return paths;
}

function buildBaseBlocks(rootDir: string, overridePaths: string[]): string[] {
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
      baseData = mergeJson(baseData, loadJsonFile(overridePath));
    }
    return [formatJsonBlock("api-base+overrides.json", baseData)];
  }
  return [formatFileBlock("api-base.json", basePath)];
}

function buildOverrideBlocks(overridePaths: string[]): string[] {
  return overridePaths.map((p) => formatFileBlock(path.basename(p), p));
}

function buildFixtureBlocks(fixtures: string[], rootDir: string): string[] {
  return fixtures.map((fixturePath) => {
    const fullPath = resolvePath(fixturePath, rootDir);
    return formatFileBlock(path.basename(fixturePath), fullPath);
  });
}

function buildPromptBlocks(
  options: PromptBuildOptions,
  rootDir: string
): string[] {
  const overridePaths = collectOverridePaths(
    options.overrides,
    options.caseId,
    rootDir
  );
  const blocks: string[] = [];

  if (options.useBase) {
    blocks.push(...buildBaseBlocks(rootDir, overridePaths));
  } else if (overridePaths.length > 0) {
    blocks.push(...buildOverrideBlocks(overridePaths));
  }

  if (options.useFixtures && options.fixtures && options.fixtures.length > 0) {
    blocks.push(...buildFixtureBlocks(options.fixtures, rootDir));
  }

  return blocks;
}

interface ResolvedPromptOptions {
  rootDir: string;
  useBase: boolean;
  useFixtures: boolean;
  injectIntoPrompt: boolean;
}

function resolvePromptOptions(
  options: PromptBuildOptions
): ResolvedPromptOptions {
  return {
    rootDir: options.rootDir ?? process.cwd(),
    useBase: options.useBase ?? process.env.EVAL_USE_BASE === "1",
    useFixtures: options.useFixtures ?? process.env.EVAL_USE_FIXTURES === "1",
    injectIntoPrompt:
      options.injectIntoPrompt ?? process.env.EVAL_INJECT_PROMPT === "1",
  };
}

function shouldSkipFixtureInjection(
  resolved: ResolvedPromptOptions,
  options: PromptBuildOptions
): boolean {
  if (!resolved.injectIntoPrompt) {
    return true;
  }
  return (
    !resolved.useFixtures &&
    !resolved.useBase &&
    (!options.overrides || options.overrides.length === 0)
  );
}

/**
 * Build an eval prompt with optional fixture context attached.
 */
export function buildEvalPrompt(
  basePrompt: string,
  options: PromptBuildOptions = {}
): string {
  const base = `${basePrompt}\n\nPlease respond with diagnosis, evidence, hypotheses, and next steps. Keep the response under 800 characters and avoid long nested fields.`;
  const resolved = resolvePromptOptions(options);

  if (shouldSkipFixtureInjection(resolved, options)) {
    return base;
  }

  const blocks = buildPromptBlocks(
    {
      ...options,
      useBase: resolved.useBase,
      useFixtures: resolved.useFixtures,
    },
    resolved.rootDir
  );
  return blocks.length === 0
    ? base
    : `${base}\n\nFixture context:\n${blocks.join("\n\n")}`;
}

function formatFileBlock(label: string, filePath: string): string {
  const contents = readFileSync(filePath, "utf8");
  return `--- ${label} ---\n${contents}`;
}

function formatJsonBlock(label: string, data: unknown): string {
  return `--- ${label} ---\n${JSON.stringify(data, null, 2)}`;
}
