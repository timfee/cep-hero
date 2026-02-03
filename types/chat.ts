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

export interface ConnectorConfigOutput {
  value?: { policyTargetKey?: { targetResource?: string | null } }[];
  targetResource?: string | null;
  attemptedTargets?: string[];
  errors?: { targetResource?: string | null; message?: string }[];
  error?: string;
  suggestion?: string;
}

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
  applyParams?: {
    policySchemaId: string;
    targetResource: string;
    value: unknown;
  };
}

export interface PolicyApplySuccessOutput {
  _type: "ui.success";
  message: string;
  policySchemaId: string;
  targetResource: string;
  appliedValue?: unknown;
}

export interface PolicyApplyErrorOutput {
  _type: "ui.error";
  message: string;
  policySchemaId: string;
  targetResource: string;
  error?: string;
  suggestion?: string;
}

export interface Hypothesis {
  cause: string;
  confidence: number;
  evidence?: string[];
}

export interface Reference {
  title: string;
  url: string;
}

export interface MissingQuestion {
  question: string;
  why?: string;
  example?: string;
}

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

export type DiagnosisResult = DiagnosisError | DiagnosisPayload;
