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

### DLP API Integration Tests

The `tests/dlp-api.test.ts` file provides comprehensive Cloud Identity DLP testing:

**Unit tests (no credentials):**

- API version verification (v1beta1 required)
- Client-side DLP rule filtering logic

**Integration tests (credentials required):**

- List DLP rules with resolved customer ID
- Create → List → Verify → Delete lifecycle
- Concurrent request handling
- `my_customer` alias support

**Required OAuth scopes for service account:**

```
https://www.googleapis.com/auth/cloud-identity.policies
https://www.googleapis.com/auth/cloud-identity.policies.readonly
https://www.googleapis.com/auth/admin.directory.orgunit
https://www.googleapis.com/auth/chrome.management.policy.readonly
```

**API Quirks Discovered:**

1. Cloud Identity requires **v1beta1** for DLP operations (v1 returns errors)
2. Filter syntax only supports `customer == "customers/{id}"` - no `setting.type.matches()`
3. DLP rules must be filtered client-side using regex `^rule\.dlp` on `setting.type`

Run DLP tests:

```bash
bun test tests/dlp-api.test.ts
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

The eval framework tests AI diagnostic capabilities using fixture injection. The runner automatically manages the dev server.

```bash
# Run evals with fixtures (recommended)
EVAL_FIXTURES=1 bun run evals

# Specific cases
EVAL_IDS="EC-071,EC-072" EVAL_FIXTURES=1 bun run evals

# Test mode (no AI calls, quota-safe)
EVAL_TEST_MODE=1 bun run evals
```

### Adding Fixtures

Fixture coverage is sparse. If a case needs evidence:

1. Add fixtures under `evals/fixtures/EC-###/`
2. Wire them in `registry.json`

## Unit Test Coverage (lib/mcp/)

Colocated unit tests in `lib/mcp/` test core business logic with inline fixtures. These require no credentials and run fast:

| File                         | Tests | What it covers                                                                                    |
| ---------------------------- | ----- | ------------------------------------------------------------------------------------------------- |
| `formatters.test.ts`         | 14    | `formatSettingType`, `formatSettingValue` branch coverage                                         |
| `org-units.test.ts`          | 31    | `normalizeResource`, `buildOrgUnitNameMap`, `resolveOrgUnitDisplay`, `buildOrgUnitTargetResource` |
| `fixture-loader.test.ts`     | 14    | `loadFixtureData` merge logic, type coercion, edge cases                                          |
| `fixture-executor.test.ts`   | 19    | Full `ToolExecutor` interface via `FixtureToolExecutor`                                           |
| `fixture-enrollment.test.ts` | 7     | `resolveEnrollmentToken` all 5 code paths                                                         |
| `connector-analysis.test.ts` | 3     | `analyzeConnectorPolicies` target classification                                                  |

### Writing Colocated Unit Tests

Place `*.test.ts` files next to the source they test in `lib/mcp/`. Use inline fixtures — do not read files from disk. This keeps tests self-contained and fast.

```typescript
import { describe, expect, it } from "bun:test";

import { myFunction } from "./my-module";

// Construct fixtures inline matching the FixtureData shape
const SAMPLE_DATA = { orgUnits: [{ orgUnitId: "id:abc" }] };

describe("myFunction", () => {
  it("handles expected input", () => {
    const result = myFunction(SAMPLE_DATA);
    expect(result).toBeDefined();
  });
});
```

### Fixture Patterns

**Inline fixtures (unit tests):** Construct minimal fixture data directly in test files. This is the preferred pattern for `lib/mcp/` tests. See `fixture-executor.test.ts` for a comprehensive example.

**File-based fixtures (eval tests):** The eval framework uses `evals/fixtures/base/api-base.json` as a shared baseline with case-specific overrides in `evals/fixtures/EC-###/overrides.json`. These are merged by `fixture-loader.ts`.

**Regenerating eval fixtures:** Run `bun run fixtures:capture` to regenerate `api-base.json` from live Google APIs. Requires `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_TOKEN_EMAIL`, and `GOOGLE_CUSTOMER_ID`. PII is automatically redacted.

### Integration Test Setup/Teardown

Integration tests in `tests/` that create temporary resources (DLP rules, org units, policies) must clean up in `afterAll`:

```typescript
const ctx: TestContext = { createdRuleNames: [] };

afterAll(async () => {
  for (const ruleName of ctx.createdRuleNames) {
    await deleteDLPRule(ctx.authClient, ruleName);
  }
});
```

See `tests/dlp-api.test.ts` for the full lifecycle pattern: create → list → verify → delete with `afterAll` cleanup.

## Best Practices

- Avoid type assertions; add minimal runtime parsing where needed
- Eval runs log progress with `[eval]` prefix; keep logging structured and brief
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive nesting
- Use `EVAL_TEST_MODE=1` for fast/quota-safe runs
- Prefer inline fixture data over file reads in unit tests
- Test all code paths in discriminated union returns (check `"error" in result` before accessing fields)
- Use `bun x ultracite check` before committing to verify formatting
