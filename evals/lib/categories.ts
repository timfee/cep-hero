/**
 * Eval category definitions organized by failure domain rather than source document.
 */

export interface EvalCategory {
  id: string;
  name: string;
  description: string;
}

/**
 * Category definitions for organizing eval cases by failure domain.
 */
export const CATEGORIES: EvalCategory[] = [
  {
    id: "enrollment",
    name: "Enrollment",
    description: "Device and browser enrollment issues, tokens, permissions",
  },
  {
    id: "network",
    name: "Network",
    description: "Network connectivity, proxy, firewall, Wi-Fi issues",
  },
  {
    id: "policy",
    name: "Policy",
    description: "Policy application, inheritance, precedence, schema issues",
  },
  {
    id: "connector",
    name: "Connector",
    description: "Chrome Connector configuration and scoping",
  },
  {
    id: "dlp",
    name: "DLP",
    description: "Data Loss Prevention rules, scanning, restrictions",
  },
  {
    id: "extensions",
    name: "Extensions",
    description: "Extension installation, permissions, state issues",
  },
  {
    id: "endpoint",
    name: "Endpoint Verification",
    description: "Endpoint Verification sync, keys, service worker issues",
  },
  {
    id: "devices",
    name: "Devices",
    description: "Device management, sync, classification, deprovisioning",
  },
  {
    id: "browser",
    name: "Browser",
    description: "Browser crashes, performance, rendering issues",
  },
  {
    id: "security",
    name: "Security",
    description:
      "Context-Aware Access, encryption, access levels, safe browsing",
  },
  {
    id: "updates",
    name: "Updates",
    description: "ChromeOS and browser update issues",
  },
  {
    id: "integration",
    name: "Integration",
    description: "Third-party integrations (Citrix, etc.)",
  },
  {
    id: "auth",
    name: "Authentication",
    description: "Authentication, tokens, session management",
  },
  {
    id: "events",
    name: "Events",
    description: "Event reporting, telemetry, logging",
  },
  {
    id: "system",
    name: "System",
    description: "API quotas, rate limits, grounding, general system issues",
  },
];

/**
 * Mapping of case IDs to their failure-domain category.
 */
export const CASE_CATEGORY_MAP: Record<string, string> = {
  "EC-001": "enrollment",
  "EC-002": "enrollment",
  "EC-004": "enrollment",
  "EC-018": "enrollment",
  "EC-046": "enrollment",
  "EC-069": "enrollment",
  "EC-070": "enrollment",

  "EC-019": "network",
  "EC-021": "network",
  "EC-029": "network",
  "EC-049": "network",
  "EC-050": "network",
  "EC-055": "network",

  "EC-005": "policy",
  "EC-006": "policy",
  "EC-022": "policy",
  "EC-038": "policy",
  "EC-039": "policy",
  "EC-040": "policy",
  "EC-041": "policy",
  "EC-042": "policy",
  "EC-058": "policy",
  "EC-059": "policy",
  "EC-068": "policy",
  "EC-071": "policy",
  "EC-072": "policy",
  "EC-073": "policy",
  "EC-081": "policy",

  "EC-051": "connector",
  "EC-057": "connector",
  "EC-064": "connector",
  "EC-065": "connector",
  "EC-066": "connector",
  "EC-067": "connector",
  "EC-080": "connector",
  "EC-082": "connector",

  "EC-033": "dlp",
  "EC-034": "dlp",
  "EC-035": "dlp",
  "EC-036": "dlp",
  "EC-037": "dlp",
  "EC-060": "dlp",
  "EC-061": "dlp",
  "EC-079": "dlp",
  "EC-084": "dlp",

  "EC-043": "extensions",
  "EC-044": "extensions",
  "EC-045": "extensions",
  "EC-053": "extensions",

  "EC-009": "endpoint",
  "EC-010": "endpoint",
  "EC-011": "endpoint",
  "EC-012": "endpoint",

  "EC-013": "devices",
  "EC-016": "devices",
  "EC-031": "devices",
  "EC-047": "devices",
  "EC-054": "devices",
  "EC-083": "devices",

  "EC-007": "browser",
  "EC-008": "browser",
  "EC-023": "browser",

  "EC-027": "security",
  "EC-028": "security",
  "EC-030": "security",
  "EC-032": "security",
  "EC-063": "security",
  "EC-085": "security",

  "EC-003": "updates",

  "EC-017": "integration",
  "EC-024": "integration",
  "EC-025": "integration",
  "EC-026": "integration",

  "EC-014": "auth",
  "EC-048": "auth",
  "EC-075": "auth",

  "EC-052": "events",
  "EC-062": "events",

  "EC-015": "system",
  "EC-020": "system",
  "EC-056": "system",
  "EC-074": "system",
  "EC-076": "system",
  "EC-077": "system",
  "EC-078": "system",
};

/**
 * Get the category for a case ID, defaulting to "system" if not mapped.
 */
export function getCategoryForCase(caseId: string) {
  return CASE_CATEGORY_MAP[caseId] ?? "system";
}
