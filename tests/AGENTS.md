# Tests Directory

See the root [AGENTS.md](../AGENTS.md) for project-wide coding standards.

## Quick Start

```bash
bun install      # Install dependencies
bun test         # Run all tests
bun test tests/  # Run this directory
```

## Framework

- **Runtime**: Bun's test runner (`bun:test`)
- **Browser APIs**: happy-dom
- **React Testing**: `@testing-library/react` with jest-dom matchers
- **Setup**: `tests/setup.tsx` preloaded via `bunfig.toml`

## Writing Tests

```typescript
import { describe, expect, it } from "bun:test";

describe("MyFeature", () => {
  it("works correctly", () => {
    expect(true).toBe(true);
  });
});
```

## Integration Tests (Google APIs)

Tests automatically skip when credentials are missing:

```typescript
const hasServiceAccount = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
const runIt = hasServiceAccount ? it : it.skip;
```

Required env vars:

- `GOOGLE_SERVICE_ACCOUNT_JSON` - Service account credentials
- `GOOGLE_TOKEN_EMAIL` - Admin email for impersonation

## Best Practices

- Use `describe`, `it`, `expect` from `"bun:test"`
- Keep tests isolated
- No `.only` or `.skip` in committed code
- Flat test structure over deep nesting
