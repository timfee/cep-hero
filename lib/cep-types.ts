export type FleetOverview = {
  totalDevices: number;
  managedDevices: number;
  unmanagedDevices: number;
  complianceRate: number;
  lastSync: string;
};

export type ConnectorStatus = {
  id: string;
  name: string;
  status: "healthy" | "degraded" | "error" | "offline";
  lastHeartbeat: string;
  version: string;
  targetResource: string;
  scope: "customer" | "orgUnit" | "group";
  issues: string[];
};

export type DLPRule = {
  id: string;
  name: string;
  enabled: boolean;
  severity: "low" | "medium" | "high" | "critical";
  triggerCount: number;
  lastTriggered: string | null;
  consoleUrl: string;
};

export type ChromeEvent = {
  id: string;
  type: "security" | "compliance" | "audit" | "error";
  severity: "info" | "warning" | "error" | "critical";
  message: string;
  timestamp: string;
  deviceId?: string;
  userId?: string;
};

export type PostureCard = {
  id: string;
  title: string;
  status: "healthy" | "warning" | "critical";
  value: string | number;
  description: string;
  trend?: "up" | "down" | "stable";
  action?: SuggestedAction;
};

export type SuggestedAction = {
  id: string;
  label: string;
  description: string;
  command: string;
  severity: "info" | "warning" | "critical";
  parameters?: Record<string, string>;
};

export type DiagnosisResult = {
  summary: string;
  hypotheses: Array<{
    description: string;
    confidence: number;
    evidence: string[];
  }>;
  planSteps: string[];
  nextSteps: SuggestedAction[];
  evidence: {
    checks: string[];
    gaps: string[];
    signals: string[];
    connectorAnalysis?: {
      status: string;
      issues: string[];
      recommendations: string[];
    };
  };
  missingQuestions?: string[];
};

export type OverviewData = {
  headline: string;
  summary: string;
  fleetOverview: FleetOverview;
  connectors: ConnectorStatus[];
  dlpRules: DLPRule[];
  recentEvents: ChromeEvent[];
  postureCards: PostureCard[];
  suggestedActions: SuggestedAction[];
  sources: string[];
};
