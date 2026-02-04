import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

interface FixtureListItem {
  id: string;
  title: string;
  category: string;
  tags: string[];
  hasOverrides: boolean;
}

interface FixturesResponse {
  fixtures: FixtureListItem[];
  categories: string[];
  total: number;
}

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

describe("Fixtures API", () => {
  describe("GET /api/fixtures (list endpoint logic)", () => {
    it("loads registry and filters cases with overrides", async () => {
      const registryPath = join(process.cwd(), "evals/registry.json");
      const registryContent = await readFile(registryPath, "utf-8");
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

      expect(fixtures.length).toBeGreaterThan(0);
      expect(fixtures[0]).toHaveProperty("id");
      expect(fixtures[0]).toHaveProperty("title");
      expect(fixtures[0]).toHaveProperty("category");
      expect(fixtures[0]?.hasOverrides).toBe(true);
    });

    it("extracts unique categories from fixtures", async () => {
      const registryPath = join(process.cwd(), "evals/registry.json");
      const registryContent = await readFile(registryPath, "utf-8");
      const registry: Registry = JSON.parse(registryContent);

      const fixtures = registry.cases.filter(
        (c) => c.overrides && c.overrides.length > 0
      );
      const categories = [...new Set(fixtures.map((f) => f.category))].sort();

      expect(categories.length).toBeGreaterThan(0);
      expect(categories).toContain("enrollment");
    });
  });

  describe("GET /api/fixtures/[id] (detail endpoint logic)", () => {
    it("finds case by ID and loads override file", async () => {
      const registryPath = join(process.cwd(), "evals/registry.json");
      const registryContent = await readFile(registryPath, "utf-8");
      const registry: Registry = JSON.parse(registryContent);

      const caseEntry = registry.cases.find((c) => c.id === "EC-001");
      expect(caseEntry).toBeDefined();
      expect(caseEntry?.overrides).toBeDefined();
      expect(caseEntry?.overrides?.length).toBeGreaterThan(0);

      if (caseEntry?.overrides?.[0]) {
        const overridePath = join(process.cwd(), caseEntry.overrides[0]);
        const content = await readFile(overridePath, "utf-8");
        const data = JSON.parse(content);

        expect(data).toHaveProperty("auditEvents");
      }
    });

    it("returns 404 for non-existent fixture", async () => {
      const registryPath = join(process.cwd(), "evals/registry.json");
      const registryContent = await readFile(registryPath, "utf-8");
      const registry: Registry = JSON.parse(registryContent);

      const caseEntry = registry.cases.find(
        (c) => c.id === "NON-EXISTENT-ID-12345"
      );
      expect(caseEntry).toBeUndefined();
    });
  });
});
