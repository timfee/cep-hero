# Library Directory

See the root [AGENTS.md](../AGENTS.md) for project-wide coding standards.

## Directory Structure

- **`mcp/`** - MCP tool system and API executors
  - `constants.ts` - Shared constants (MS_PER_DAY, CONNECTOR_POLICY_SCHEMAS)
  - `errors.ts` - ApiResult<T> type, logging utilities, error handling
  - `types.ts` - Shared type definitions
  - `executor/` - API integration implementations
- **`chat/`** - Chat service orchestration
- **`gimme/`** - Self-enrollment module
- **`fixtures/`** - Fixture context for testing
- **`test-helpers/`** - Test utilities

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

## Rules

- Prefer pure helpers returning structured errors over throwing
- Use narrow, runtime-safe type guards
- Keep logging structured and tagged; avoid secrets
- Import directly from source files, not barrel exports
