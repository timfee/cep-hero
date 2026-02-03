import { analyzeConnectorPolicies } from "@/lib/mcp/connector-analysis";
import { type CepToolExecutor } from "@/lib/mcp/registry";
import { type EvidencePayload } from "@/types/chat";

type EventsResult = Awaited<ReturnType<CepToolExecutor["getChromeEvents"]>>;
type DlpResult = Awaited<ReturnType<CepToolExecutor["listDLPRules"]>>;
type ConnectorResult = Awaited<
  ReturnType<CepToolExecutor["getChromeConnectorConfiguration"]>
>;
type AuthResult = Awaited<ReturnType<CepToolExecutor["debugAuth"]>>;
type ConnectorAnalysisResult = ReturnType<typeof analyzeConnectorPolicies>;

type Check = NonNullable<EvidencePayload["checks"]>[number];
type Gap = NonNullable<EvidencePayload["gaps"]>[number];
type Signal = NonNullable<EvidencePayload["signals"]>[number];

interface EvidenceAccumulator {
  checks: Check[];
  gaps: Gap[];
  signals: Signal[];
}

const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/admin.directory.orgunit",
  "https://www.googleapis.com/auth/chrome.management.policy",
];

function processEventsResult(
  eventsResult: EventsResult,
  acc: EvidenceAccumulator
): void {
  if (!("events" in eventsResult)) {
    return;
  }
  const count = eventsResult.events?.length ?? 0;
  acc.checks.push({
    name: "Chrome events",
    status: count > 0 ? "pass" : "unknown",
    source: "Admin SDK Reports",
    detail: `events=${count}`,
  });
}

function processDlpResult(
  dlpResult: DlpResult,
  acc: EvidenceAccumulator
): void {
  if (!("rules" in dlpResult)) {
    return;
  }
  const count = dlpResult.rules?.length ?? 0;
  acc.checks.push({
    name: "DLP rules",
    status: count > 0 ? "pass" : "fail",
    source: "Cloud Identity",
    detail: `rules=${count}`,
  });
}

function processConnectorSuccess(
  connectorResult: Extract<ConnectorResult, { value: unknown }>,
  analysis: ConnectorAnalysisResult,
  acc: EvidenceAccumulator
): void {
  const count = connectorResult.value?.length ?? 0;
  acc.checks.push({
    name: "Connector policies",
    status: count > 0 ? "pass" : "unknown",
    source: "Chrome Policy",
    detail: `policies=${count}; ${analysis.detail}`,
  });
  if (count === 0) {
    return;
  }
  acc.signals.push({
    type: "connector-policies",
    source: "Chrome Policy",
    summary: analysis.flag
      ? "Some connector policies target customers (need org units or groups)"
      : "Connector policies scoped to org units/groups",
  });
  if (analysis.flag) {
    acc.gaps.push({
      missing: "Connector policies scoped to org units or groups",
      why:
        analysis.sampleTarget ??
        "Policies are applied at customer level; must target org units or groups.",
    });
  }
}

function processConnectorError(
  connectorResult: Extract<ConnectorResult, { error: string }>,
  acc: EvidenceAccumulator
): void {
  acc.checks.push({
    name: "Connector policies",
    status: "unknown",
    source: "Chrome Policy",
    detail: connectorResult.error,
  });
  acc.gaps.push({
    missing: "Connector policies",
    why: connectorResult.error,
  });
}

function processConnectorResult(
  connectorResult: ConnectorResult,
  analysis: ConnectorAnalysisResult,
  acc: EvidenceAccumulator
): void {
  if ("value" in connectorResult) {
    processConnectorSuccess(connectorResult, analysis, acc);
  } else if ("error" in connectorResult) {
    processConnectorError(connectorResult, acc);
  }
}

function processAuthSuccess(
  authResult: Extract<AuthResult, { scopes: string[] }>,
  acc: EvidenceAccumulator
): void {
  const { scopes } = authResult;
  const missing = REQUIRED_SCOPES.filter((scope) => !scopes.includes(scope));
  acc.checks.push({
    name: "Auth scopes",
    status: missing.length === 0 ? "pass" : "fail",
    source: "OAuth tokeninfo",
    detail:
      missing.length === 0
        ? "All required scopes present"
        : `Missing: ${missing.join(", ")}`,
  });
  if (missing.length > 0) {
    acc.gaps.push({
      missing: "Admin scopes",
      why: `Token lacks required scopes: ${missing.join(", ")}`,
    });
  }
}

function processAuthError(
  authResult: Extract<AuthResult, { error: string }>,
  acc: EvidenceAccumulator
): void {
  acc.checks.push({
    name: "Auth scopes",
    status: "unknown",
    source: "OAuth tokeninfo",
    detail: authResult.error,
  });
  acc.gaps.push({ missing: "Token scope insight", why: authResult.error });
}

function processAuthResult(
  authDebugResult: AuthResult | undefined,
  acc: EvidenceAccumulator
): void {
  if (!authDebugResult) {
    return;
  }
  if ("scopes" in authDebugResult) {
    processAuthSuccess(authDebugResult, acc);
  } else if ("error" in authDebugResult) {
    processAuthError(authDebugResult, acc);
  }
}

/**
 * Build evidence payloads for tests without calling the model.
 */
export function buildEvidenceForTest({
  eventsResult,
  dlpResult,
  connectorResult,
  connectorAnalysis,
  authDebugResult,
}: {
  eventsResult: EventsResult;
  dlpResult: DlpResult;
  connectorResult: ConnectorResult;
  connectorAnalysis?: ConnectorAnalysisResult;
  authDebugResult?: AuthResult;
}): EvidencePayload {
  const analysis =
    connectorAnalysis ??
    analyzeConnectorPolicies(
      "value" in connectorResult && Array.isArray(connectorResult.value)
        ? connectorResult.value
        : []
    );

  const acc: EvidenceAccumulator = { checks: [], gaps: [], signals: [] };

  processEventsResult(eventsResult, acc);
  processDlpResult(dlpResult, acc);
  processConnectorResult(connectorResult, analysis, acc);
  processAuthResult(authDebugResult, acc);

  return {
    checks: acc.checks,
    gaps: acc.gaps,
    signals: acc.signals,
    sources: ["Admin SDK Reports", "Cloud Identity", "Chrome Policy"],
    connectorAnalysis: analysis,
  };
}
