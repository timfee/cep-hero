import type { CepToolExecutor } from "@/lib/mcp/registry";
import type { EvidencePayload } from "@/types/chat";

import { analyzeConnectorPolicies } from "@/lib/mcp/connector-analysis";

/**
 * Build evidence payloads for tests without calling the model.
 */
export function buildEvidenceForTest({
  eventsResult,
  dlpResult,
  connectorResult,
  connectorAnalysis,
}: {
  eventsResult: Awaited<ReturnType<CepToolExecutor["getChromeEvents"]>>;
  dlpResult: Awaited<ReturnType<CepToolExecutor["listDLPRules"]>>;
  connectorResult: Awaited<
    ReturnType<CepToolExecutor["getChromeConnectorConfiguration"]>
  >;
  connectorAnalysis?: ReturnType<typeof analyzeConnectorPolicies>;
}): EvidencePayload {
  const analysis =
    connectorAnalysis ??
    analyzeConnectorPolicies(
      "value" in connectorResult && Array.isArray(connectorResult.value)
        ? connectorResult.value
        : []
    );

  const checks: EvidencePayload["checks"] = [];
  const gaps: EvidencePayload["gaps"] = [];
  const signals: EvidencePayload["signals"] = [];

  // Events minimal handling for tests
  if ("events" in eventsResult) {
    const count = eventsResult.events?.length ?? 0;
    checks.push({
      name: "Chrome events",
      status: count > 0 ? "pass" : "unknown",
      source: "Admin SDK Reports",
      detail: `events=${count}`,
    });
  }

  // DLP minimal handling for tests
  if ("rules" in dlpResult) {
    const count = dlpResult.rules?.length ?? 0;
    checks.push({
      name: "DLP rules",
      status: count > 0 ? "pass" : "fail",
      source: "Cloud Identity",
      detail: `rules=${count}`,
    });
  }

  // Connector handling mirrors app/api/chat/diagnose.ts core logic
  if ("value" in connectorResult) {
    const count = connectorResult.value?.length ?? 0;
    checks.push({
      name: "Connector policies",
      status: count > 0 ? "pass" : "unknown",
      source: "Chrome Policy",
      detail: `policies=${count}; ${analysis.detail}`,
    });
    if (count > 0) {
      signals.push({
        type: "connector-policies",
        source: "Chrome Policy",
        summary: analysis.flag
          ? "Some connector policies target customers (need org units or groups)"
          : "Connector policies scoped to org units/groups",
      });
      if (analysis.flag) {
        gaps.push({
          missing: "Connector policies scoped to org units or groups",
          why:
            analysis.sampleTarget ??
            "Policies are applied at customer level; must target org units or groups.",
        });
      }
    }
  }

  const evidence: EvidencePayload = {
    checks,
    gaps,
    signals,
    sources: ["Admin SDK Reports", "Cloud Identity", "Chrome Policy"],
    connectorAnalysis: analysis,
  };

  return evidence;
}
