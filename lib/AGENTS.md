# Library Directory

See the root [AGENTS.md](../AGENTS.md) for project-wide coding standards.

## Directory Structure

- **`mcp/`** - MCP tool system and API executors
  - `constants.ts` - Shared constants (MS_PER_DAY, CONNECTOR_POLICY_SCHEMAS)
  - `errors.ts` - ApiResult<T> type, logging utilities, error handling
  - `types.ts` - Shared type definitions
  - `executor/` - API integration implementations
    - `dlp-list.ts` - Cloud Identity DLP rule listing (uses v1beta1)
    - `dlp-create.ts` - DLP rule creation with manual fallback
    - `dlp-delete.ts` - DLP rule deletion
    - `context.ts` - Org unit context fetching
- **`chat/`** - Chat service orchestration
- **`gimme/`** - Self-enrollment module
- **`fixtures/`** - Fixture context for testing
- **`test-helpers/`** - Test utilities
- **`google-service-account.ts`** - Service account auth with domain-wide delegation

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
