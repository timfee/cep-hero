export type DiagnosisError = { error: string };

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
