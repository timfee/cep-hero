import { type FixtureData } from "./types";

/**
 * Load and merge fixture data from base and override files.
 */
export function loadFixtureData(
  baseData: unknown,
  overrideData?: unknown
): FixtureData {
  const base = isPlainObject(baseData) ? baseData : {};
  const override = isPlainObject(overrideData) ? overrideData : {};

  const merged = mergeJson(base, override);
  const mergedObject = isPlainObject(merged) ? merged : {};

  return {
    orgUnits: Array.isArray(mergedObject.orgUnits)
      ? mergedObject.orgUnits
      : undefined,
    auditEvents: isPlainObject(mergedObject.auditEvents)
      ? (mergedObject.auditEvents as FixtureData["auditEvents"])
      : undefined,
    dlpRules: Array.isArray(mergedObject.dlpRules)
      ? mergedObject.dlpRules
      : undefined,
    connectorPolicies: Array.isArray(mergedObject.connectorPolicies)
      ? mergedObject.connectorPolicies
      : undefined,
    policySchemas: Array.isArray(mergedObject.policySchemas)
      ? mergedObject.policySchemas
      : undefined,
    chromeReports: isPlainObject(mergedObject.chromeReports)
      ? mergedObject.chromeReports
      : undefined,
    enrollmentToken: isPlainObject(mergedObject.enrollmentToken)
      ? (mergedObject.enrollmentToken as FixtureData["enrollmentToken"])
      : undefined,
    browsers: Array.isArray(mergedObject.browsers)
      ? mergedObject.browsers
      : undefined,
    errors: isPlainObject(mergedObject.errors)
      ? (mergedObject.errors as FixtureData["errors"])
      : undefined,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeJson(base: unknown, override: unknown): unknown {
  if (override === undefined) {
    return base;
  }
  if (base === undefined) {
    return override;
  }
  if (isPlainObject(base) && isPlainObject(override)) {
    const result: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(override)) {
      result[key] = mergeJson(result[key], value);
    }
    return result;
  }
  return override;
}
