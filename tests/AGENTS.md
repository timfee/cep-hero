# Tests Layer Notes

This document provides guidance for AI agents working with the test suite.

## Quick Start

```bash
# Install dependencies (required before first test run)
bun install

# Run all unit tests
bun test

# Run tests in specific directories
bun test tests/ app/ lib/ components/
```

## Test Framework

- **Runtime**: Bun's built-in test runner (not Jest/Vitest)
- **Browser APIs**: happy-dom with `@happy-dom/global-registrator`
- **React Testing**: `@testing-library/react` with `@testing-library/jest-dom` matchers
- **Setup**: `tests/setup.tsx` is preloaded via `bunfig.toml`

### Key Configuration Files

- `bunfig.toml`: Test preload configuration
- `package.json`: Test script (`bun test tests/ app/ lib/ components/`)

## Writing Tests

### Unit Tests

- Use `describe`, `it`, `expect` from `"bun:test"`
- Files must have `.test.ts` or `.test.tsx` extension
- Keep tests isolated; prefer helpers in `lib/test-helpers`
- Use explicit assertions and clear failure messages

```typescript
import { describe, expect, it } from "bun:test";

describe("MyComponent", () => {
  it("renders correctly", () => {
    expect(true).toBe(true);
  });
});
```

### React Component Tests

- Use `render` from `@testing-library/react`
- DOM matchers available via `@testing-library/jest-dom`
- happy-dom provides browser-like environment

```typescript
import { render } from "@testing-library/react";
import { describe, expect, it } from "bun:test";

describe("Button", () => {
  it("renders children", () => {
    const { getByText } = render(<Button>Click me</Button>);
    expect(getByText("Click me")).toBeInTheDocument();
  });
});
```

### Integration Tests (Google APIs)

Integration tests that require Google Workspace Admin APIs need:

1. `GOOGLE_SERVICE_ACCOUNT_JSON`: Service account credentials with domain-wide delegation
2. `GOOGLE_TOKEN_EMAIL`: Admin user email for impersonation
3. `GOOGLE_CUSTOMER_ID` (optional): Customer ID, auto-detected if not set

**Tests automatically skip** when:

- Credentials are not configured
- Service account lacks required Admin API permissions

Example pattern for integration tests:

```typescript
const hasServiceAccount = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
const runIt = hasServiceAccount ? it : it.skip;

// Validate permissions before running
async function validateCredentials(): Promise<boolean> {
  // Make a lightweight API call to check permissions
  // Return false if 403/Forbidden
}

runIt("integration test", async () => {
  if (!(await validateCredentials())) return;
  // Test code here
});
```

## Environment Variables

Environment variables may contain surrounding quotes that need stripping:

```typescript
const value = process.env.MY_VAR?.replace(/^['"]|['"]$/g, "");
```

**Common issues:**

- `GOOGLE_TOKEN_EMAIL` with quotes causes "Invalid impersonation sub field" errors
- Already handled in `lib/google-service-account.ts`

## Evaluation Framework

The eval framework tests AI diagnostic capabilities using fixture injection.

```bash
# Run evals with fixtures (recommended)
EVAL_USE_BASE=1 bun run evals

# Specific cases
EVAL_IDS="EC-071,EC-072" EVAL_USE_BASE=1 bun run evals

# Fast mode (server already running)
EVAL_USE_BASE=1 bun run evals:fast

# Test mode (no AI calls, quota-safe)
EVAL_TEST_MODE=1 bun run evals
```

### Adding Fixtures

Fixture coverage is sparse. If a case needs evidence:

1. Add fixtures under `evals/fixtures/EC-###/`
2. Wire them in `registry.json`

## Best Practices

- Avoid type assertions; add minimal runtime parsing where needed
- Eval runs log progress with `[eval]` prefix; keep logging structured and brief
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive nesting
- Use `EVAL_TEST_MODE=1` for fast/quota-safe runs
