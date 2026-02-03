import { readFile } from "node:fs/promises";
import { join, normalize, resolve } from "node:path";

import { type FixtureData } from "@/lib/mcp/types";

interface RegistryCase {
  id: string;
  title: string;
  category: string;
  tags?: string[];
  overrides?: string[];
}

interface Registry {
  version: string;
  cases: RegistryCase[];
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

const FIXTURES_BASE_DIR = "evals/fixtures";

/**
 * Validates that a path is within the allowed fixtures directory.
 * Prevents path traversal attacks.
 */
function isPathWithinFixtures(filePath: string): boolean {
  const baseDir = resolve(process.cwd(), FIXTURES_BASE_DIR);
  const resolvedPath = resolve(process.cwd(), filePath);
  return resolvedPath.startsWith(baseDir);
}

/**
 * GET /api/fixtures/[id]
 * Returns the fixture data for a specific scenario.
 * Only available in development or when EVAL_TEST_MODE is enabled.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  // Feature flag: only allow in development or explicit test mode
  const isDev = process.env.NODE_ENV === "development";
  const isTestMode = process.env.EVAL_TEST_MODE === "1";
  if (!isDev && !isTestMode) {
    return Response.json(
      { error: "Fixture API is not available in production" },
      { status: 403 }
    );
  }

  const { id } = await params;

  // Load registry
  let registry: Registry;
  try {
    const registryPath = join(process.cwd(), "evals/registry.json");
    const registryContent = await readFile(registryPath, "utf8");
    registry = JSON.parse(registryContent);
  } catch {
    return Response.json(
      { error: "Failed to load fixture registry" },
      { status: 500 }
    );
  }

  const caseEntry = registry.cases.find((c) => c.id === id);
  if (!caseEntry) {
    return Response.json(
      { error: `Fixture not found: ${id}` },
      { status: 404 }
    );
  }

  if (!caseEntry.overrides || caseEntry.overrides.length === 0) {
    return Response.json(
      { error: `Fixture ${id} has no override data` },
      { status: 404 }
    );
  }

  // Load and merge all override files for this case
  let fixtureData: FixtureData = {};
  for (const overridePath of caseEntry.overrides) {
    // Validate path is within fixtures directory
    const normalizedPath = normalize(overridePath);
    if (!isPathWithinFixtures(normalizedPath)) {
      return Response.json(
        { error: `Invalid fixture path: ${overridePath}` },
        { status: 400 }
      );
    }

    try {
      const fullPath = join(process.cwd(), normalizedPath);
      const content = await readFile(fullPath, "utf8");
      const overrideData = JSON.parse(content) as FixtureData;
      fixtureData = mergeFixtureData(fixtureData, overrideData);
    } catch {
      return Response.json(
        { error: `Failed to load fixture file: ${overridePath}` },
        { status: 500 }
      );
    }
  }

  return Response.json({
    id: caseEntry.id,
    title: caseEntry.title,
    category: caseEntry.category,
    tags: caseEntry.tags ?? [],
    data: fixtureData,
  });
}

/**
 * Checks if a value is a plain object (not an array or null).
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Recursively deep merges two values.
 * Arrays are replaced entirely (not merged).
 * Objects are recursively merged.
 * Primitives are replaced.
 */
function deepMergeValues(base: unknown, override: unknown): unknown {
  // Arrays are replaced entirely
  if (Array.isArray(override)) {
    return override;
  }

  // If both are plain objects, recursively merge
  if (isPlainObject(base) && isPlainObject(override)) {
    const result: Record<string, unknown> = { ...base };
    for (const key of Object.keys(override)) {
      result[key] = deepMergeValues(base[key], override[key]);
    }
    return result;
  }

  // Otherwise, override wins
  return override;
}

/**
 * Deep merge fixture data, with later values overriding earlier ones.
 * Arrays are replaced entirely (not merged).
 * Objects are recursively deep merged.
 */
function mergeFixtureData(
  base: FixtureData,
  override: FixtureData
): FixtureData {
  return deepMergeValues(base, override) as FixtureData;
}
