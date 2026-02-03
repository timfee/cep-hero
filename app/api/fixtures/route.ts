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
 */
export async function GET() {
  const registryPath = join(process.cwd(), "evals/registry.json");

  const registryContent = await readFile(registryPath, "utf8");
  const registry: Registry = JSON.parse(registryContent);

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
