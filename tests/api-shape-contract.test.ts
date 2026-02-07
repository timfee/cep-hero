/**
 * Contract tests that verify our types and fixtures match actual Google API
 * TypeScript definitions from node_modules/googleapis. These tests catch
 * field name mismatches (e.g. targetKey vs policyTargetKey) that unit tests
 * cannot detect because unit tests only verify internal consistency.
 */

import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { loadFixtureData } from "@/lib/mcp/fixture-loader";

const CHROMEPOLICY_TYPES_PATH = path.join(
  process.cwd(),
  "node_modules/googleapis/build/src/apis/chromepolicy/v1.d.ts"
);

const ADMIN_TYPES_PATH = path.join(
  process.cwd(),
  "node_modules/googleapis/build/src/apis/admin/reports_v1.d.ts"
);

const API_BASE_PATH = path.join(
  process.cwd(),
  "evals/fixtures/base/api-base.json"
);

/**
 * Extract an interface body from a .d.ts file by name.
 */
function extractInterface(fileContent: string, interfaceName: string): string {
  const pattern = new RegExp(
    `export interface ${interfaceName}\\s*\\{([\\s\\S]*?)\\n    \\}`,
    "m"
  );
  const match = fileContent.match(pattern);
  if (!match) {
    throw new Error(`Interface ${interfaceName} not found in type definitions`);
  }
  return match[1];
}

/**
 * Extract field names from an interface body string.
 */
function extractFieldNames(interfaceBody: string): string[] {
  const fieldPattern = /^\s+([\w]+)\??:/gm;
  const fields: string[] = [];
  let match: RegExpExecArray | null = fieldPattern.exec(interfaceBody);
  while (match !== null) {
    fields.push(match[1]);
    match = fieldPattern.exec(interfaceBody);
  }
  return fields;
}

describe("API shape contract: Chrome Policy resolve response", () => {
  const chromePolicyTypes = readFileSync(CHROMEPOLICY_TYPES_PATH, "utf8");

  it("ResolvedPolicy has targetKey (not policyTargetKey)", () => {
    const body = extractInterface(
      chromePolicyTypes,
      "Schema\\$GoogleChromePolicyVersionsV1ResolvedPolicy"
    );
    const fields = extractFieldNames(body);

    expect(fields).toContain("targetKey");
    expect(fields).not.toContain("policyTargetKey");
  });

  it("ResolvedPolicy has sourceKey field", () => {
    const body = extractInterface(
      chromePolicyTypes,
      "Schema\\$GoogleChromePolicyVersionsV1ResolvedPolicy"
    );
    const fields = extractFieldNames(body);

    expect(fields).toContain("sourceKey");
  });

  it("ModifyOrgUnitPolicyRequest has policyTargetKey (request side)", () => {
    const body = extractInterface(
      chromePolicyTypes,
      "Schema\\$GoogleChromePolicyVersionsV1ModifyOrgUnitPolicyRequest"
    );
    const fields = extractFieldNames(body);

    expect(fields).toContain("policyTargetKey");
    expect(fields).not.toContain("targetKey");
  });
});

describe("API shape contract: FixtureData matches Google API types", () => {
  it("FixtureData.connectorPolicies uses targetKey (matching ResolvedPolicy)", () => {
    const typesFile = readFileSync(
      path.join(process.cwd(), "lib/mcp/types.ts"),
      "utf8"
    );

    // Extract the connectorPolicies type definition
    const connectorMatch = typesFile.match(
      /connectorPolicies\?:\s*\{([\s\S]*?)\}\[\]/
    );
    expect(connectorMatch).not.toBeNull();

    const connectorBody = connectorMatch![1];
    expect(connectorBody).toContain("targetKey");
    expect(connectorBody).not.toContain("policyTargetKey");
  });

  it("ConnectorConfigOutput uses targetKey (matching ResolvedPolicy)", () => {
    const chatTypes = readFileSync(
      path.join(process.cwd(), "types/chat.ts"),
      "utf8"
    );

    const connectorMatch = chatTypes.match(
      /ConnectorConfigOutput[\s\S]*?value\?:\s*\{([\s\S]*?)\}\[\]/
    );
    expect(connectorMatch).not.toBeNull();

    const valueBody = connectorMatch![1];
    expect(valueBody).toContain("targetKey");
    expect(valueBody).not.toContain("policyTargetKey");
  });
});

describe("API shape contract: connector-analysis reads correct field", () => {
  it("reads targetKey from policy objects (not policyTargetKey)", () => {
    const analysisFile = readFileSync(
      path.join(process.cwd(), "lib/mcp/connector-analysis.ts"),
      "utf8"
    );

    expect(analysisFile).toContain("policy.targetKey");
    expect(analysisFile).not.toContain("policy.policyTargetKey");
  });
});

describe("API shape contract: connector-policies-card reads correct field", () => {
  it("reads targetKey from policy objects (not policyTargetKey)", () => {
    const cardFile = readFileSync(
      path.join(
        process.cwd(),
        "components/ai-elements/connector-policies-card.tsx"
      ),
      "utf8"
    );

    expect(cardFile).toContain("policy.targetKey");
    expect(cardFile).not.toContain("policy.policyTargetKey");
  });
});

/**
 * Collect all eval fixture override files from the fixtures directory.
 */
function listFixtureOverrides(): string[] {
  const fixturesDir = path.join(process.cwd(), "evals/fixtures");
  const dirs = readdirSync(fixturesDir, { withFileTypes: true });
  const files: string[] = [];
  for (const dir of dirs) {
    if (!dir.isDirectory()) {
      continue;
    }
    const overridePath = path.join(fixturesDir, dir.name, "overrides.json");
    try {
      readFileSync(overridePath);
      files.push(overridePath);
    } catch {
      // No overrides.json in this directory
    }
  }
  return files;
}

describe("API shape contract: eval fixtures use correct field names", () => {
  const fixtureFiles = listFixtureOverrides();

  it("no eval fixture uses policyTargetKey in connector policy data", () => {
    const violations: string[] = [];
    for (const file of fixtureFiles) {
      const content = readFileSync(file, "utf8");
      if (content.includes('"policyTargetKey"')) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });

  it("fixtures with connectorPolicies use targetKey", () => {
    for (const file of fixtureFiles) {
      const content = readFileSync(file, "utf8");
      if (!content.includes("connectorPolicies")) {
        continue;
      }

      const data = JSON.parse(content);
      const policies = data.connectorPolicies ?? [];
      for (const policy of policies) {
        expect(policy).toHaveProperty("targetKey");
        expect(policy).not.toHaveProperty("policyTargetKey");
      }
    }
  });
});

describe("API shape contract: captured base fixtures are loadable", () => {
  it("api-base.json loads through fixture loader without errors", () => {
    const raw = JSON.parse(readFileSync(API_BASE_PATH, "utf8"));
    const fixtures = loadFixtureData(raw);

    expect(fixtures.orgUnits).toBeDefined();
    expect(Array.isArray(fixtures.orgUnits)).toBe(true);
    expect(fixtures.orgUnits!.length).toBeGreaterThan(0);
  });

  it("captured orgUnits have required fields", () => {
    const raw = JSON.parse(readFileSync(API_BASE_PATH, "utf8"));
    const fixtures = loadFixtureData(raw);

    for (const ou of fixtures.orgUnits ?? []) {
      expect(typeof ou.orgUnitId).toBe("string");
      expect(typeof ou.name).toBe("string");
      expect(typeof ou.orgUnitPath).toBe("string");
    }
  });

  it("captured auditEvents match Admin SDK Reports shape", () => {
    const raw = JSON.parse(readFileSync(API_BASE_PATH, "utf8"));
    const fixtures = loadFixtureData(raw);

    expect(fixtures.auditEvents).toBeDefined();
    expect(fixtures.auditEvents!.items).toBeDefined();
    expect(fixtures.auditEvents!.items!.length).toBeGreaterThan(0);

    const first = fixtures.auditEvents!.items![0];
    expect(first.id).toBeDefined();
    expect(typeof first.id!.time).toBe("string");
    expect(first.actor).toBeDefined();
    expect(first.events).toBeDefined();
    expect(Array.isArray(first.events)).toBe(true);
  });

  it("captured connectorPolicies use targetKey if present", () => {
    const raw = JSON.parse(readFileSync(API_BASE_PATH, "utf8"));
    const fixtures = loadFixtureData(raw);

    for (const policy of fixtures.connectorPolicies ?? []) {
      if (Object.keys(policy).length > 0) {
        expect(policy).toHaveProperty("targetKey");
        expect(policy).not.toHaveProperty("policyTargetKey");
      }
    }
  });
});

describe("API shape contract: draftPolicyChange uses policySchemaId", () => {
  it("DraftPolicyChangeSchema has policySchemaId field", () => {
    const schemasFile = readFileSync(
      path.join(process.cwd(), "lib/mcp/schemas.ts"),
      "utf8"
    );

    expect(schemasFile).toContain("policySchemaId:");
  });

  it("applyParams.policySchemaId is set from args.policySchemaId (not policyName)", () => {
    const policyFile = readFileSync(
      path.join(process.cwd(), "lib/mcp/executor/policy.ts"),
      "utf8"
    );

    expect(policyFile).toContain("policySchemaId: args.policySchemaId");
    expect(policyFile).not.toMatch(/policySchemaId:\s*args\.policyName/);

    const fixtureFile = readFileSync(
      path.join(process.cwd(), "lib/mcp/fixture-executor.ts"),
      "utf8"
    );

    expect(fixtureFile).toContain("policySchemaId: args.policySchemaId");
    expect(fixtureFile).not.toMatch(/policySchemaId:\s*args\.policyName/);
  });
});
