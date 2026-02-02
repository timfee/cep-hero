/**
 * Maps technical API terms to admin-friendly language.
 * Use these consistently across all UI components.
 */
export const TERMINOLOGY: Record<string, string> = {
  // Headers and titles
  "Cloud Identity DLP rules": "Data Protection Rules",
  "Connector policy targets": "Policy Scope",
  "Recent Chrome events": "Recent Activity",
  "Chrome events": "Browser Activity",
  "DLP rules": "Data Protection Rules",
  "Connector policies": "Security Policies",
  "Org units": "Organizational Units",
  "Attempted targets": "Checked Locations",

  // Status and states
  "output-available": "Complete",
  "input-streaming": "Starting",
  "input-available": "Running",
  "output-error": "Failed",

  // Tool names (for display)
  getChromeEvents: "Checking browser activity",
  listDLPRules: "Loading data protection rules",
  getChromeConnectorConfiguration: "Checking security policies",
  enrollBrowser: "Creating enrollment token",
  listOrgUnits: "Loading organizational structure",
  getFleetOverview: "Analyzing fleet status",
  debugAuth: "Verifying permissions",
  suggestActions: "Preparing suggestions",
};

export function humanize(term: string): string {
  return TERMINOLOGY[term] ?? term;
}

/**
 * Tooltips explaining technical concepts for admins.
 */
export const TOOLTIPS: Record<string, string> = {
  dlpRules:
    "Data Loss Prevention rules control what data users can share outside your organization.",
  connectorPolicies:
    "Connector policies determine which security features are enabled for your Chrome browsers.",
  chromeEvents:
    "Activity logs showing security-relevant actions from managed Chrome browsers.",
  orgUnits:
    "Organizational units let you apply different policies to different groups of users or devices.",
  targetResource:
    "The scope where a policy applies - can be your entire organization, specific departments, or groups.",
  policyScope:
    "Determines which users or devices a policy affects. Policies can target your entire organization, specific organizational units, or groups.",
};

/**
 * Format a tool name for display in the UI.
 */
export function humanizeToolName(toolName: string): string {
  return TERMINOLOGY[toolName] ?? toolName.replace(/([A-Z])/g, " $1").trim();
}
