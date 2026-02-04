/**
 * Fixture loading utilities for evals that handle loading base fixtures and case-specific overrides.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { type FixtureData } from "@/lib/mcp/types";

import {
  deepMerge,
  isNonEmptyString,
  isPlainObject,
  loadJsonFile,
} from "./utils";

export interface LoadFixturesOptions {
  useBase?: boolean;
  useFixtures?: boolean;
  rootDir?: string;
}

/**
 * Load base fixtures from the common api-base.json file.
 */
function loadBaseFixtures(rootDir: string, useBase: boolean) {
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

/**
 * Load case-specific override fixtures.
 */
function loadCaseOverrides(rootDir: string, caseId: string) {
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

/**
 * Transform merged fixture object into typed FixtureData.
 */
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
 * Check if fixtures are enabled via EVAL_FIXTURES environment variable.
 */
function isFixturesEnabled(): boolean {
  return process.env.EVAL_FIXTURES === "1";
}

/**
 * Load fixture data for an eval case by merging base fixtures with case-specific overrides.
 */
export function loadEvalFixtures(
  caseId: string,
  options: LoadFixturesOptions = {}
) {
  const fixturesEnabled = isFixturesEnabled();
  const {
    useBase = fixturesEnabled,
    useFixtures = fixturesEnabled,
    rootDir = process.cwd(),
  } = options;

  if (!useBase && !useFixtures) {
    return;
  }

  const baseData = loadBaseFixtures(rootDir, useBase);
  const overrideData = loadCaseOverrides(rootDir, caseId);
  const merged = deepMerge(baseData, overrideData);
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

/**
 * Resolve a file path, making it absolute if relative.
 */
function resolvePath(filePath: string, rootDir: string) {
  return path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath);
}

/**
 * Collect all override file paths for the prompt.
 */
function collectOverridePaths(
  overrides: string[] | undefined,
  caseId: string | undefined,
  rootDir: string
) {
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

/**
 * Build content blocks for base fixtures, optionally merged with overrides.
 */
function buildBaseBlocks(rootDir: string, overridePaths: string[]) {
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
      baseData = deepMerge(baseData, loadJsonFile(overridePath));
    }
    return [formatJsonBlock("api-base+overrides.json", baseData)];
  }
  return [formatFileBlock("api-base.json", basePath)];
}

/**
 * Build content blocks for standalone override files.
 */
function buildOverrideBlocks(overridePaths: string[]) {
  return overridePaths.map((p) => formatFileBlock(path.basename(p), p));
}

/**
 * Build content blocks for explicit fixture files.
 */
function buildFixtureBlocks(fixtures: string[], rootDir: string) {
  return fixtures.map((fixturePath) => {
    const fullPath = resolvePath(fixturePath, rootDir);
    return formatFileBlock(path.basename(fixturePath), fullPath);
  });
}

/**
 * Build all prompt blocks based on options.
 */
function buildPromptBlocks(options: PromptBuildOptions, rootDir: string) {
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

/**
 * Resolve prompt build options from explicit values or environment variables.
 */
function resolvePromptOptions(
  options: PromptBuildOptions
): ResolvedPromptOptions {
  const fixturesEnabled = isFixturesEnabled();
  return {
    rootDir: options.rootDir ?? process.cwd(),
    useBase: options.useBase ?? fixturesEnabled,
    useFixtures: options.useFixtures ?? fixturesEnabled,
    injectIntoPrompt:
      options.injectIntoPrompt ?? process.env.EVAL_INJECT_PROMPT === "1",
  };
}

/**
 * Determine if fixture injection into prompt should be skipped.
 */
function shouldSkipFixtureInjection(
  resolved: ResolvedPromptOptions,
  options: PromptBuildOptions
) {
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
) {
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

/**
 * Format a file's contents as a labeled block.
 */
function formatFileBlock(label: string, filePath: string) {
  const contents = readFileSync(filePath, "utf8");
  return `--- ${label} ---\n${contents}`;
}

/**
 * Format JSON data as a labeled block.
 */
function formatJsonBlock(label: string, data: unknown) {
  return `--- ${label} ---\n${JSON.stringify(data, null, 2)}`;
}
