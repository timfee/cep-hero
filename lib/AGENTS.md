# Library Directory

See the root [AGENTS.md](../AGENTS.md) for project-wide coding standards.

## Directory Structure

- **`mcp/`** - MCP tool system and API executors
  - `constants.ts` - Shared constants (MS_PER_DAY, CONNECTOR_POLICY_SCHEMAS)
  - `errors.ts` - ApiResult<T> type, logging utilities, error handling
  - `types.ts` - ToolExecutor interface and shared type definitions
  - `schemas.ts` - Zod schemas for all tool input/output validation
  - `registry.ts` - Central re-export hub for MCP schemas and utilities
  - `server-factory.ts` - MCP server creation with CEP tool registrations
  - `transport.ts` - MCP transport layer configuration
  - `formatters.ts` - Human-readable formatting for Cloud Identity settings (avoids `[object Object]`)
  - `org-units.ts` - Org unit name resolution, resource building, and display mapping
  - `connector-analysis.ts` - Analyzes connector policy mis-scoping across org units
  - `fixture-executor.ts` - Fixture-based ToolExecutor for deterministic testing
  - `fixture-loader.ts` - Loads and merges fixture data from JSON files
  - `fixture-enrollment.ts` - Fixture data for enrollment scenarios
  - `executor/` - Production API integration implementations
    - `index.ts` - Main CepToolExecutor class orchestrating all Google APIs
    - `auth.ts` - OAuth2 authentication and credential handling
    - `chrome-events.ts` - Chrome audit events (security logs)
    - `connector.ts` - Chrome connector/reporting policy configuration
    - `context.ts` - Organization context and customer ID resolution
    - `dlp-list.ts` - Cloud Identity DLP rule listing (uses v1beta1)
    - `dlp-create.ts` - DLP rule creation with manual fallback
    - `dlp-delete.ts` - DLP rule deletion
    - `enrollment.ts` - Browser enrollment operations
    - `org-units-api.ts` - Organizational unit operations
    - `policy.ts` - Policy change drafting and application
    - `utils.ts` - Helper utilities for API operations
  - `fleet-overview/` - Dashboard extraction and summarization
    - `types.ts` - Type definitions for fleet metrics
    - `extract.ts` - Extracts facts from Chrome reporting APIs
    - `summarize.ts` - AI summarization with fallback, deterministic card styling
- **`chat/`** - Chat service orchestration
  - `chat-service.ts` - Main AI orchestration (system prompt, tool registration, conversation guards)
  - `auth-service.ts` - Chat authentication
  - `request-utils.ts` - Request body parsing and validation
- **`auth.ts`** - Better Auth configuration
- **`auth/`** - Auth status utilities
  - `status.ts` - `formatTimeRemaining` and session status formatting
- **`auth-client.ts`** - Client-side auth utilities
- **`overview.ts`** - Dashboard types (OverviewData, OverviewCard, Suggestion) and `sanitizeOverview` for PII redaction
- **`gimme/`** - Self-enrollment module (includes server actions)
  - `validation.ts` - Input validation and `stripQuotes` utility for env var handling
- **`default-user.ts`** - Default user auto-sign-in configuration
- **`fixtures/`** - Fixture context for demo mode
  - `context.tsx` - React context for fixture data injection
- **`test-helpers/`** - Test utilities
  - `chat-client.ts` - Chat API test client
  - `diagnose-evidence.ts` - Evidence collection test helpers
  - `eval-server.ts` - Eval server startup/shutdown
  - `google-admin.ts` - Google Admin API test utilities
- **`google-service-account.ts`** - Service account auth with domain-wide delegation
- **`upstash/`** - Vector search for knowledge grounding
  - `search.ts` - Vector search operations
- **`fixture-types.ts`** - Fixture data structure types
- **`terminology.ts`** - Domain terminology definitions
- **`rate-limit.ts`** - Rate limiting utilities
- **`debug-log.ts`** - Debug logging
- **`utils.ts`** - General utilities (includes shared helpers)

## Key Patterns

### API Results

Use `ApiResult<T>` from `errors.ts`:

```typescript
import { ok, err, isSuccess } from "@/lib/mcp/errors";

// Success
return ok({ events: items });

// Error
return err("Failed", "Check permissions", false);
```

### Logging

Use unified logging:

```typescript
import { logApiRequest, logApiResponse, logApiError } from "@/lib/mcp/errors";
```

### Constants

Add shared values to `constants.ts`:

```typescript
import { MS_PER_DAY, CONNECTOR_POLICY_SCHEMAS } from "@/lib/mcp/constants";
```

### Org Unit Resolution

Use `OrgUnitDisplay` component with `OrgUnitMapProvider` context for rendering friendly org unit names in the UI. For server-side formatting, use helpers from `org-units.ts`:

```typescript
import {
  buildOrgUnitNameMap,
  resolveOrgUnitDisplay,
} from "@/lib/mcp/org-units";
```

### Quote Stripping

Environment variables may contain surrounding quotes. Use the shared utility:

```typescript
import { stripQuotes } from "@/lib/gimme/validation";
const email = stripQuotes(process.env.GOOGLE_TOKEN_EMAIL);
```

## Cloud Identity API (DLP)

DLP operations require **v1beta1** and client-side filtering:

```typescript
const service = googleApis.cloudidentity({ version: "v1beta1", auth });
const res = await service.policies.list({
  filter: `customer == "customers/${customerId}"`,
});
// API doesn't support setting.type filter - must filter client-side
const dlpRules = res.data.policies?.filter((p) =>
  /^rule\.dlp/i.test(p.setting?.type)
);
```

## Rules

- Prefer pure helpers returning structured errors over throwing
- Use narrow, runtime-safe type guards
- Keep logging structured and tagged; avoid secrets
- Import directly from source files, not barrel exports
- Use **v1beta1** for all Cloud Identity DLP operations
- Use `formatSettingValue` from `formatters.ts` to avoid `[object Object]` in output
- Use `sanitizeOverview` from `overview.ts` before exposing fleet data to the frontend
