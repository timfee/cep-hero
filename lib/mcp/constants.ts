/**
 * Shared constants for MCP tool operations.
 */

/**
 * Milliseconds in one day. Used for time window calculations.
 */
export const MS_PER_DAY = 86_400_000;

/**
 * Policy schemas relevant to Chrome connector configuration.
 * Used by both production executor and fixture executor.
 */
export const CONNECTOR_POLICY_SCHEMAS = [
  "chrome.users.SafeBrowsingProtectionLevel",
  "chrome.users.SafeBrowsingExtendedReporting",
  "chrome.users.SafeBrowsingAllowlistDomain",
  "chrome.users.SafeBrowsingForTrustedSourcesEnabled",
  "chrome.users.SafeBrowsingDeepScanningEnabled",
  "chrome.users.CloudReporting",
  "chrome.users.CloudProfileReportingEnabled",
  "chrome.users.CloudReportingUploadFrequencyV2",
  "chrome.users.MetricsReportingEnabled",
  "chrome.users.DataLeakPreventionReportingEnabled",
] as const;

/**
 * Type for connector policy schema IDs.
 */
export type ConnectorPolicySchema = (typeof CONNECTOR_POLICY_SCHEMAS)[number];

/**
 * Default customer ID for Google Workspace operations.
 */
export const DEFAULT_CUSTOMER_ID = "my_customer";

/**
 * Default target for customer-wide operations.
 */
export const DEFAULT_CUSTOMER_TARGET = "customers/my_customer";

/**
 * Policy schema ID for browser enrollment tokens.
 */
export const ENROLLMENT_TOKEN_POLICY_SCHEMA = "chrome.users.EnrollmentToken";

/**
 * Maps Chrome Enterprise Connector policy schema IDs to their API value field
 * names. These are the only policies that accept array values.
 */
export const CONNECTOR_VALUE_KEYS: Record<string, string> = {
  "chrome.users.EnterpriseConnectors.OnFileAttached":
    "onFileAttachedEnterpriseConnector",
  "chrome.users.EnterpriseConnectors.OnFileDownloaded":
    "onFileDownloadedEnterpriseConnector",
  "chrome.users.EnterpriseConnectors.OnBulkDataEntry":
    "onBulkDataEntryEnterpriseConnector",
  "chrome.users.EnterpriseConnectors.OnSecurityEvent":
    "onSecurityEventEnterpriseConnector",
  "chrome.users.EnterpriseConnectors.OnPrint": "onPrintEnterpriseConnector",
} as const;

/**
 * Tools whose output is consumed by dedicated UI (sources drawer, dashboard,
 * action buttons) rather than displayed as tool-call cards. Shared between
 * server guard logic and client rendering.
 */
export const HIDDEN_TOOL_NAMES = new Set<string>([
  "getFleetOverview",
  "searchKnowledge",
  "debugAuth",
  "suggestActions",
]);
