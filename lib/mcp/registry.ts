/**
 * MCP Registry - Re-exports from modular components.
 *
 * This file maintains backwards compatibility by re-exporting
 * all schemas and the CepToolExecutor from their new locations.
 */

// Re-export all schemas
export {
  ApplyPolicyChangeSchema,
  CreateDLPRuleSchema,
  DraftPolicyChangeSchema,
  EnrollBrowserSchema,
  FleetOverviewResponseSchema,
  GetChromeEventsSchema,
  GetConnectorConfigSchema,
  GetFleetOverviewSchema,
  ListDLPRulesSchema,
  ListOrgUnitsSchema,
  type FleetOverviewResponse,
} from "./schemas";

// Re-export the main executor
export { CepToolExecutor } from "./executor";

// Re-export fleet overview utilities
export {
  buildFallbackOverview,
  extractFleetOverviewFacts,
  summarizeFleetOverview,
} from "./fleet-overview";

// Re-export error utilities
export { createApiError, getErrorDetails, getErrorMessage } from "./errors";

// Re-export org unit utilities
export {
  buildOrgUnitNameMap,
  buildOrgUnitTargetResource,
  normalizeResource,
  resolveOrgUnitDisplay,
} from "./org-units";
