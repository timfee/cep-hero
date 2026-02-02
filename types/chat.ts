export type DiagnosisError = { error: string };

/**
 * Tool invocation part used by the chat UI.
 */
export type ToolInvocationPart = {
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
};

/**
 * Output shape for suggestActions tool.
 */
export type SuggestedActionsOutput = {
  actions: string[];
};

export type ChromeEventsOutput = {
  events?: Array<{
    id?: { time?: string | null; uniqueQualifier?: string | null };
    actor?: { email?: string | null; profileId?: string | null };
    events?: Array<{ name?: string | null; type?: string | null }>;
  }>;
  nextPageToken?: string | null;
  error?: string;
  suggestion?: string;
};

export type DlpRulesOutput = {
  rules?: Array<{
    id?: string;
    displayName?: string;
    description?: string;
    consoleUrl?: string;
  }>;
  error?: string;
  suggestion?: string;
};

export type ConnectorConfigOutput = {
  value?: Array<{ policyTargetKey?: { targetResource?: string | null } }>;
  targetResource?: string | null;
  attemptedTargets?: string[];
  errors?: Array<{ targetResource?: string | null; message?: string }>;
  error?: string;
  suggestion?: string;
};

export type Hypothesis = {
  cause: string;
  confidence: number;
  evidence?: string[];
};

export type Reference = {
  title: string;
  url: string;
};

export type MissingQuestion = {
  question: string;
  why?: string;
  example?: string;
};

export type ConnectorAnalysis = {
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
};

export type EvidencePayload = {
  checks?: Array<{
    name: string;
    status: "pass" | "fail" | "unknown";
    detail?: string;
    source?: string;
  }>;
  gaps?: Array<{ missing: string; why: string }>;
  signals?: Array<{
    type: string;
    source: string;
    summary: string;
    referenceUrl?: string;
  }>;
  sources?: string[];
  connectorAnalysis?: ConnectorAnalysis;
};

export type DiagnosisPayload = {
  diagnosis?: string;
  hypotheses?: Hypothesis[];
  nextSteps?: string[];
  actionsRequiringConfirmation?: string[];
  planSteps?: string[];
  missingQuestions?: MissingQuestion[];
  evidence?: EvidencePayload;
  reference?: Reference | null;
};

export type DiagnosisResult = DiagnosisError | DiagnosisPayload;
