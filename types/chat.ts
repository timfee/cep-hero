/**
 * Chat-related type definitions for tool outputs and diagnosis results.
 */

/**
 * Error response from diagnosis operations.
 */
export interface DiagnosisError {
  error: string;
}

/**
 * Tool invocation part used by the chat UI.
 */
export interface ToolInvocationPart {
  type: `tool-${string}` | "dynamic-tool";
  state:
    | "input-available"
    | "output-available"
    | "output-error"
    | "output-denied";
  input?: unknown;
  output?: unknown;
  error?: string;
  errorText?: string;
}

/**
 * Output shape for suggestActions tool.
 */
export interface SuggestedActionsOutput {
  actions: string[];
}

/**
 * Output shape for Chrome events API responses.
 */
export interface ChromeEventsOutput {
  events?: {
    id?: { time?: string | null; uniqueQualifier?: string | null };
    actor?: { email?: string | null; profileId?: string | null };
    events?: { name?: string | null; type?: string | null }[];
  }[];
  nextPageToken?: string | null;
  error?: string;
  suggestion?: string;
}

/**
 * Output shape for DLP rules API responses.
 */
export interface DlpRulesOutput {
  rules?: {
    id?: string;
    displayName?: string;
    description?: string;
    consoleUrl?: string;
  }[];
  error?: string;
  suggestion?: string;
}

/**
 * Output shape for connector configuration API responses.
 */
export interface ConnectorConfigOutput {
  value?: { targetKey?: { targetResource?: string | null } }[];
  targetResource?: string | null;
  targetResourceName?: string | null;
  attemptedTargets?: string[];
  errors?: { targetResource?: string | null; message?: string }[];
  error?: string;
  suggestion?: string;
}

/**
 * UI confirmation response for policy change proposals.
 */
export interface PolicyChangeConfirmationOutput {
  _type: "ui.confirmation";
  proposalId: string;
  title: string;
  description: string;
  diff: unknown;
  target: string;
  adminConsoleUrl: string;
  intent: string;
  status: string;
  applyParams: {
    policySchemaId: string;
    targetResource: string;
    value: unknown;
  };
}

/**
 * Success response after applying a policy change.
 */
export interface PolicyApplySuccessOutput {
  _type: "ui.success";
  message: string;
  policySchemaId: string;
  targetResource: string;
  appliedValue?: unknown;
}

/**
 * Error response when policy application fails.
 */
export interface PolicyApplyErrorOutput {
  _type: "ui.error";
  message: string;
  policySchemaId: string;
  targetResource: string;
  error?: string;
  suggestion?: string;
}

/**
 * A diagnostic hypothesis with confidence and supporting evidence.
 */
export interface Hypothesis {
  cause: string;
  confidence: number;
  evidence?: string[];
}

/**
 * Documentation reference link.
 */
export interface Reference {
  title: string;
  url: string;
}

/**
 * A question needed to complete the diagnosis.
 */
export interface MissingQuestion {
  question: string;
  why?: string;
  example?: string;
}

/**
 * Analysis of connector policy targeting and potential mis-scoping.
 */
export interface ConnectorAnalysis {
  total: number;
  byTarget: {
    customer: number;
    orgUnit: number;
    group: number;
    unknown: number;
  };
  misScoped: number;
  detail: string;
  flag: boolean;
  sampleTarget?: string;
}

/**
 * Evidence collected during diagnostic analysis.
 */
export interface EvidencePayload {
  checks?: {
    name: string;
    status: "pass" | "fail" | "unknown";
    detail?: string;
    source?: string;
  }[];
  gaps?: { missing: string; why: string }[];
  signals?: {
    type: string;
    source: string;
    summary: string;
    referenceUrl?: string;
  }[];
  sources?: string[];
  connectorAnalysis?: ConnectorAnalysis;
}

/**
 * Complete diagnostic output with hypotheses, steps, and evidence.
 */
export interface DiagnosisPayload {
  diagnosis?: string;
  hypotheses?: Hypothesis[];
  nextSteps?: string[];
  actionsRequiringConfirmation?: string[];
  planSteps?: string[];
  missingQuestions?: MissingQuestion[];
  evidence?: EvidencePayload;
  reference?: Reference | null;
}

/**
 * Successful tool result with a confirmation message and optional console link.
 */
export interface ToolResultSuccess {
  _type: "ui.success";
  message: string;
  consoleUrl?: string;
}

/**
 * Error tool result with diagnostic details and optional remediation suggestion.
 */
export interface ToolResultError {
  _type: "ui.error";
  message?: string;
  error?: string;
  suggestion?: string;
  consoleUrl?: string;
}

/**
 * Manual-steps fallback when an automated action could not complete.
 */
export interface ToolResultManualSteps {
  _type: "ui.manual_steps";
  message: string;
  error?: string;
  steps: string[];
  consoleUrl?: string;
}

/**
 * Discriminated union for tool result outputs rendered by ToolResultCard.
 */
export type ToolResultOutput =
  | ToolResultSuccess
  | ToolResultError
  | ToolResultManualSteps;

/**
 * Union type for diagnosis results - either success payload or error.
 */
export type DiagnosisResult = DiagnosisError | DiagnosisPayload;
