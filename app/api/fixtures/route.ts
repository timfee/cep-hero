import { readFile } from "node:fs/promises";
import { join } from "node:path";

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

export interface FixtureListItem {
  id: string;
  title: string;
  category: string;
  tags: string[];
  hasOverrides: boolean;
}

/**
 * GET /api/fixtures
 * Returns a list of available fixture scenarios that can be used to override live data.
 * Only includes cases that have override files.
 * Only available in development or when EVAL_TEST_MODE is enabled.
 */
export async function GET() {
  // Feature flag: only allow in development or explicit test mode
  const isDev = process.env.NODE_ENV === "development";
  const isTestMode = process.env.EVAL_TEST_MODE === "1";
  if (!isDev && !isTestMode) {
    return Response.json(
      { error: "Fixture API is not available in production" },
      { status: 403 }
    );
  }

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

  const fixtures: FixtureListItem[] = registry.cases
    .filter((c) => c.overrides && c.overrides.length > 0)
    .map((c) => ({
      id: c.id,
      title: c.title,
      category: c.category,
      tags: c.tags ?? [],
      hasOverrides: true,
    }));

  // Group by category for easier UI consumption
  const categories = [...new Set(fixtures.map((f) => f.category))].toSorted();

  return Response.json({
    fixtures,
    categories,
    total: fixtures.length,
  });
}
