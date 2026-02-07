/**
 * Proactive guardrail tests for MCP tool output quality.
 *
 * These tests exercise every tool through the FixtureToolExecutor, serialize
 * results exactly as the MCP server does (JSON.stringify), and assert that
 * entire classes of bad output never appear — regardless of what specific
 * data is in the fixtures. When a new tool or output field is added, these
 * tests automatically cover it.
 */

import { describe, expect, it } from "bun:test";

import { FixtureToolExecutor } from "./fixture-executor";
import { formatSettingType, formatSettingValue } from "./formatters";
import { type FixtureData } from "./types";

/**
 * Fixtures with realistic nested objects and arrays that previously caused
 * [object Object] in output. Intentionally includes complex nested data
 * to stress-test the serialization pipeline.
 */
const STRESS_FIXTURES: FixtureData = {
  orgUnits: [
    {
      orgUnitId: "id:root001",
      orgUnitPath: "/",
      name: "Root",
      parentOrgUnitId: null,
    },
    {
      orgUnitId: "id:eng002",
      orgUnitPath: "/Engineering",
      name: "Engineering",
      parentOrgUnitId: "id:root001",
    },
    {
      orgUnitId: "id:sales003",
      orgUnitPath: "/Sales/West Coast",
      name: "West Coast",
      parentOrgUnitId: "id:root001",
    },
  ],
  auditEvents: {
    items: [
      {
        kind: "admin#reports#activity",
        id: { time: "2026-01-20T04:00:00Z", applicationName: "chrome" },
        events: [
          {
            type: "CONTENT_TRANSFER_TYPE",
            name: "CONTENT_TRANSFER",
            parameters: [
              { name: "EVENT_RESULT", value: "BLOCKED" },
              { name: "DESTINATION_URL", value: "https://example.com" },
              { name: "MULTI_FIELD", multiValue: ["a", "b", "c"] },
            ],
          },
        ],
      },
    ],
  },
  dlpRules: [
    {
      name: "policies/dlp-rule-1",
      displayName: "Block uploads",
      description: "Prevent uploads to external services",
      triggers: ["UPLOAD", "DOWNLOAD"],
      action: "BLOCK",
      targetResource: "id:eng002",
    },
    {
      name: "policies/dlp-rule-2",
      displayName: "Audit all traffic",
      description: "Monitor everything at root",
      triggers: ["UPLOAD"],
      action: "AUDIT",
      targetResource: "id:root001",
    },
    {
      name: "policies/dlp-rule-3",
      displayName: "Clipboard guard",
      triggers: ["CLIPBOARD"],
      action: "WARN",
      orgUnit: "/",
    },
  ],
  connectorPolicies: [
    {
      policyTargetKey: { targetResource: "orgunits/root001" },
      value: {
        policySchema: "chrome.users.ConnectorEnabled",
        value: { enabled: true, nested: { deep: "value" } },
      },
    },
  ],
  enrollmentToken: {
    token: "test-token-456",
    expiresAt: "2026-12-31T23:59:59Z",
    status: "valid",
  },
};

/**
 * Patterns that must NEVER appear in any MCP tool output.
 * Each entry is [pattern, description].
 */
const FORBIDDEN_PATTERNS: [RegExp, string][] = [
  [/\[object Object\]/i, "[object Object] from unhandled object coercion"],
  [/\bundefined\b/, "literal 'undefined' string (missing value)"],
  [/\bNaN\b/, "literal 'NaN' from bad number conversion"],
];

/**
 * Serializes a result exactly like the MCP server does.
 */
function mcpSerialize(result: unknown): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Asserts that serialized output contains no forbidden patterns.
 */
function assertCleanOutput(serialized: string, toolName: string) {
  for (const [pattern, description] of FORBIDDEN_PATTERNS) {
    const match = pattern.exec(serialized);
    if (match) {
      throw new Error(
        `${toolName} output contains ${description}:\n` +
          `  Found: "${match[0]}" at index ${match.index}\n` +
          `  Context: ...${serialized.slice(Math.max(0, match.index - 40), match.index + 60)}...`
      );
    }
  }
}

describe("MCP output guardrails", () => {
  const executor = new FixtureToolExecutor(STRESS_FIXTURES);

  describe("no forbidden patterns in any tool output", () => {
    it("getChromeEvents output is clean", async () => {
      const result = await executor.getChromeEvents({});
      assertCleanOutput(mcpSerialize(result), "getChromeEvents");
    });

    it("listDLPRules output is clean", async () => {
      const result = await executor.listDLPRules();
      assertCleanOutput(mcpSerialize(result), "listDLPRules");
    });

    it("listOrgUnits output is clean", async () => {
      const result = await executor.listOrgUnits();
      assertCleanOutput(mcpSerialize(result), "listOrgUnits");
    });

    it("enrollBrowser output is clean", async () => {
      const result = await executor.enrollBrowser({
        orgUnitId: "id:eng002",
      });
      assertCleanOutput(mcpSerialize(result), "enrollBrowser");
    });

    it("getChromeConnectorConfiguration output is clean", async () => {
      const result = await executor.getChromeConnectorConfiguration();
      assertCleanOutput(
        mcpSerialize(result),
        "getChromeConnectorConfiguration"
      );
    });

    it("debugAuth output is clean", async () => {
      const result = await executor.debugAuth();
      assertCleanOutput(mcpSerialize(result), "debugAuth");
    });

    it("draftPolicyChange output is clean", async () => {
      const result = await executor.draftPolicyChange({
        policyName: "chrome.users.SafeBrowsing",
        policySchemaId: "chrome.users.SafeBrowsing",
        proposedValue: { enabled: true, level: { mode: "strict" } },
        targetUnit: "id:eng002",
        reasoning: "Enable strict safe browsing",
      });
      assertCleanOutput(mcpSerialize(result), "draftPolicyChange");
    });

    it("applyPolicyChange output is clean", async () => {
      const result = await executor.applyPolicyChange({
        policySchemaId: "chrome.users.SafeBrowsing",
        targetResource: "orgunits/eng002",
        value: { enabled: true },
      });
      assertCleanOutput(mcpSerialize(result), "applyPolicyChange");
    });

    it("createDLPRule output is clean", async () => {
      const result = await executor.createDLPRule({
        displayName: "Test guardrail rule",
        targetOrgUnit: "id:eng002",
        triggers: ["UPLOAD", "DOWNLOAD"],
        action: "BLOCK",
      });
      assertCleanOutput(mcpSerialize(result), "createDLPRule");
    });

    it("getFleetOverview output is clean", async () => {
      const result = await executor.getFleetOverview({});
      assertCleanOutput(mcpSerialize(result), "getFleetOverview");
    });
  });

  describe("root org unit is never a bare slash in display fields", () => {
    it("listDLPRules resolves root org unit to a path, not bare slash", async () => {
      const result = await executor.listDLPRules();
      const serialized = mcpSerialize(result);

      if ("rules" in result) {
        for (const rule of result.rules) {
          expect(rule.orgUnit).not.toBe("/");
        }
      }

      // Ensure no field has "/" as its entire value (bare root indicator)
      const bareSlashFields = serialized.match(/"orgUnit":\s*"\/"/g);
      expect(bareSlashFields).toBeNull();
    });

    it("draftPolicyChange resolves root org unit target", async () => {
      const result = await executor.draftPolicyChange({
        policyName: "chrome.users.Test",
        policySchemaId: "chrome.users.Test",
        proposedValue: { test: true },
        targetUnit: "id:root001",
        reasoning: "Test root target",
      });

      expect(result.target).not.toBe("/");
    });

    it("createDLPRule resolves root org unit target", async () => {
      const result = await executor.createDLPRule({
        displayName: "Root rule",
        targetOrgUnit: "id:root001",
        triggers: ["UPLOAD"],
        action: "AUDIT",
      });

      expect(result.targetOrgUnit).not.toBe("/");
    });
  });

  describe("formatters never produce [object Object]", () => {
    const EVIL_VALUES: [string, Record<string, unknown>][] = [
      ["nested object", { action: { type: "BLOCK", severity: "HIGH" } }],
      ["array of strings", { triggers: ["upload", "download", "print"] }],
      ["array of objects", { rules: [{ id: 1 }, { id: 2 }] }],
      ["mixed types", { name: "test", config: { nested: true }, tags: ["a"] }],
      ["deeply nested", { a: { b: { c: { d: "deep" } } } }],
      ["empty object", { config: {} }],
      ["empty array", { items: [] }],
      ["null value", { setting: null }],
    ];

    for (const [label, value] of EVIL_VALUES) {
      it(`formatSettingValue handles ${label}`, () => {
        const result = formatSettingValue(value);
        expect(result).not.toContain("[object Object]");
      });
    }

    it("formatSettingType never produces [object Object]", () => {
      const inputs = [
        "settings/rule.dlp.upload",
        "chrome.users.SafeBrowsing",
        "",
        "enrollment",
        "rule_dlp_upload",
      ];
      for (const input of inputs) {
        const result = formatSettingType(input);
        expect(result).not.toContain("[object Object]");
      }
    });
  });

  describe("draftPolicyChange proposal values never produce [object Object]", () => {
    /**
     * Regression: the PolicyChangeConfirmation component's formatPolicyValue
     * used String(value) which converts nested objects to "[object Object]".
     * These tests ensure that any value shape the executor produces can be
     * safely serialized without information loss.
     */
    const NESTED_POLICY_VALUES: [string, unknown][] = [
      ["nested config object", { enabled: true, level: { mode: "strict" } }],
      [
        "DLP-shaped value",
        { displayName: "Audit rule", triggers: ["UPLOAD"], action: "AUDIT" },
      ],
      ["deep nesting", { a: { b: { c: "deep" } } }],
      ["array of objects", { rules: [{ id: 1 }, { id: 2 }] }],
      ["null fields", { enabled: null }],
      ["boolean", { enabled: true }],
      ["string", { name: "test" }],
    ];

    for (const [label, proposedValue] of NESTED_POLICY_VALUES) {
      it(`draftPolicyChange output for ${label} serializes cleanly`, async () => {
        const result = await executor.draftPolicyChange({
          policyName: "chrome.users.TestPolicy",
          policySchemaId: "chrome.users.TestPolicy",
          proposedValue,
          targetUnit: "id:eng002",
          reasoning: "Test nested values",
        });
        const serialized = mcpSerialize(result);
        expect(serialized).not.toContain("[object Object]");

        // Also verify the diff and applyParams.value fields individually
        const diffStr = JSON.stringify(result.diff);
        const valueStr = JSON.stringify(result.applyParams?.value);
        expect(diffStr).not.toContain("[object Object]");
        expect(valueStr).not.toContain("[object Object]");
      });
    }
  });
});
