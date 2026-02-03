import { readFile } from "node:fs/promises";
import { join } from "node:path";

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

/**
 * GET /api/fixtures/[id]
 * Returns the fixture data for a specific scenario.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;

  const registryPath = join(process.cwd(), "evals/registry.json");
  const registryContent = await readFile(registryPath, "utf8");
  const registry: Registry = JSON.parse(registryContent);

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
    const fullPath = join(process.cwd(), overridePath);
    const content = await readFile(fullPath, "utf8");
    const overrideData = JSON.parse(content) as FixtureData;
    fixtureData = mergeFixtureData(fixtureData, overrideData);
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
 * Deep merge fixture data, with later values overriding earlier ones.
 */
function mergeFixtureData(
  base: FixtureData,
  override: FixtureData
): FixtureData {
  const result: FixtureData = { ...base };

  for (const key of Object.keys(override) as (keyof FixtureData)[]) {
    const overrideValue = override[key];
    if (overrideValue === undefined) {
      continue;
    }

    // Arrays are replaced entirely, not merged
    if (Array.isArray(overrideValue)) {
      (result as Record<string, unknown>)[key] = overrideValue;
    }
    // Objects are deep merged
    else if (typeof overrideValue === "object" && overrideValue !== null) {
      const baseValue = result[key];
      if (
        typeof baseValue === "object" &&
        baseValue !== null &&
        !Array.isArray(baseValue)
      ) {
        (result as Record<string, unknown>)[key] = {
          ...baseValue,
          ...overrideValue,
        };
      } else {
        (result as Record<string, unknown>)[key] = overrideValue;
      }
    }
    // Primitives are replaced
    else {
      (result as Record<string, unknown>)[key] = overrideValue;
    }
  }

  return result;
}
