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
 * Load the fixture registry from disk.
 */
async function loadRegistry(): Promise<Registry | null> {
  try {
    const registryPath = join(process.cwd(), "evals/registry.json");
    const registryContent = await readFile(registryPath, "utf8");
    return JSON.parse(registryContent);
  } catch {
    return null;
  }
}

type FixtureOverridesResult =
  | { success: true; data: FixtureData }
  | { success: false; error: string; status: number };

/**
 * Type guard for fixture overrides errors.
 */
function isFixtureError(
  result: FixtureOverridesResult
): result is { success: false; error: string; status: number } {
  return !result.success;
}

/**
 * Load and merge fixture override files for a case.
 */
async function loadFixtureOverrides(
  overrides: string[]
): Promise<FixtureOverridesResult> {
  let fixtureData: FixtureData = {};

  for (const overridePath of overrides) {
    const normalizedPath = normalize(overridePath);
    if (!isPathWithinFixtures(normalizedPath)) {
      return {
        success: false,
        error: `Invalid fixture path: ${overridePath}`,
        status: 400,
      };
    }

    try {
      const fullPath = join(process.cwd(), normalizedPath);
      const content = await readFile(fullPath, "utf8");
      const overrideData = JSON.parse(content) as FixtureData;
      fixtureData = mergeFixtureData(fixtureData, overrideData);
    } catch {
      return {
        success: false,
        error: `Failed to load fixture file: ${overridePath}`,
        status: 500,
      };
    }
  }

  return { success: true, data: fixtureData };
}

/**
 * GET /api/fixtures/[id]
 * Returns the fixture data for a specific scenario.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const registry = await loadRegistry();
  if (!registry) {
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

  const result = await loadFixtureOverrides(caseEntry.overrides);
  if (isFixtureError(result)) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({
    id: caseEntry.id,
    title: caseEntry.title,
    category: caseEntry.category,
    tags: caseEntry.tags ?? [],
    data: result.data,
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
