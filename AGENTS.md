# Code Standards

## Quick Reference

- **Format code**: `bun x ultracite fix`
- **Check for issues**: `bun x ultracite check`
- **Diagnose setup**: `bun x ultracite doctor`

Oxlint + Oxfmt (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

## Documentation Standards (JSDoc/TSDoc)

All code must be documented to help new engineers understand the codebase. Follow these requirements strictly.

> **Note:** Oxlint validates JSDoc syntax but cannot enforce JSDoc presence (no `require-jsdoc` rule exists, and custom plugin comment APIs are not yet available). These standards are enforced through code review and AI agent instructions.

### File-Level Documentation

Every TypeScript file MUST begin with a file-level JSDoc comment describing its role:

```typescript
/**
 * Human-readable formatting utilities for Cloud Identity settings.
 */
```

### Function Documentation

Every exported function and class method MUST have a multi-line JSDoc comment:

```typescript
/**
 * Formats a Cloud Identity setting type into a human-readable name.
 */
export function formatSettingType(settingType: string) {
```

**Format requirements:**

- Use multi-line format with `/**` on its own line
- Description only - do NOT use `@param` or `@return` tags
- Keep descriptions concise but informative
- Explain the "why" not the "what" when the function name is self-explanatory

### Type and Interface Documentation

Every exported type, interface, and type alias MUST have a JSDoc comment:

```typescript
/**
 * Result from fetching Chrome audit events.
 */
export type ChromeEventsResult = { ... }

/**
 * Contract for CEP tool execution. Implementations include CepToolExecutor
 * for production API calls and FixtureToolExecutor for deterministic testing.
 */
export interface ToolExecutor { ... }
```

### What NOT to Document

- Private helper functions with obvious purpose (use judgment)
- Inline type definitions within function signatures

### Code Organization

- Two blank lines between top-level declarations (functions, classes, types)
- One blank line between substantially different blocks within a function
- Group related code together
- Do not re-export; do not clog code with backwards-compatability shims.

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- For this POC, structured `console.log` output is allowed; include a consistent tag and avoid secrets
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases
- Eval suites log per-case progress with `[eval]` prefix; keep logs concise and structured.

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)

### Framework-Specific Guidance

- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components
- Use ref as a prop instead of `React.forwardRef`

## Testing

### Quick Start

```bash
# Install dependencies (required first)
bun install

# Run all unit tests
bun test

# Run specific test directories
bun test tests/ app/ lib/ components/

# Run linting
bun x ultracite check
```

### Test Framework

- **Runtime**: Bun's built-in test runner (`bun:test`)
- **Browser APIs**: happy-dom (configured in `tests/setup.tsx`)
- **React Testing**: `@testing-library/react` with jest-dom matchers

### Integration Tests

Integration tests requiring Google Workspace Admin APIs automatically skip when:

- `GOOGLE_SERVICE_ACCOUNT_JSON` is not set
- Service account lacks required Admin API permissions

### Best Practices

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

See `tests/AGENTS.md` for detailed testing guidance.

### Environment Variables

Environment variables set via shell or `.env` files may contain surrounding quotes that need to be stripped. This is a common source of subtle bugs.

**When debugging Google API authentication errors:**

1. Check if env vars have surrounding quotes: `echo "${VAR_NAME:0:1}"` - if it shows `'` or `"`, quotes need stripping
2. The error `Invalid impersonation "sub" field` typically means `GOOGLE_TOKEN_EMAIL` has quotes around the email
3. Always strip quotes from env vars before using them: `value.replace(/^['"]|['"]$/g, "")`

**Common env vars that need quote handling:**

- `GOOGLE_SERVICE_ACCOUNT_JSON` - JSON credentials (already handled in `lib/google-service-account.ts`)
- `GOOGLE_TOKEN_EMAIL` - Email for domain-wide delegation impersonation
- `GOOGLE_CUSTOMER_ID` - Google Workspace customer ID

**Bun env file behavior:**

Bun's env parser converts `\n` escape sequences to actual newlines when loading `.env.local`. This breaks JSON parsing of service account credentials (the `private_key` field contains `\n`). The `lib/google-service-account.ts` handler tries parsing as-is first, then falls back to fixing newlines if parsing fails.

## Google API Version Requirements

Different Google APIs require specific versions:

| API               | Version     | Notes                       |
| ----------------- | ----------- | --------------------------- |
| Chrome Policy     | v1          | Standard policy resolution  |
| Chrome Management | v1          | Reports, profiles           |
| Admin SDK         | reports_v1  | Audit events                |
| Cloud Identity    | **v1beta1** | Required for DLP operations |

**Cloud Identity DLP Quirks:**

1. The v1 API does not support DLP rule operations properly
2. Filter syntax only supports `customer == "customers/{id}"` - NOT `setting.type.matches()`
3. DLP rules are filtered client-side using regex `^rule\.dlp` on `setting.type`
4. The `my_customer` alias works in the customer filter

```typescript
// Correct usage for DLP
const service = googleApis.cloudidentity({ version: "v1beta1", auth });
const res = await service.policies.list({
  filter: `customer == "customers/${customerId}"`,
});
const dlpRules = res.data.policies?.filter((p) =>
  /^rule\.dlp/i.test(p.setting?.type)
);
```

## Evaluation Framework

> **Agent rule: Do NOT run evals (`bun run evals`) as part of routine development.** Evals are expensive (they make AI API calls and take significant time). Only run evals when the user explicitly asks you to. Running unit tests (`bun test`) and linting (`bun x ultracite check`) is fine for routine validation — evals are not.

The eval framework tests AI diagnostic capabilities using fixture injection for deterministic, reproducible results.

### Architecture

The system uses dependency injection to swap between production and eval modes:

- **`ToolExecutor`** interface (`lib/mcp/types.ts`) - Contract for tool execution
- **`CepToolExecutor`** (`lib/mcp/executor/index.ts`) - Production implementation calling Google APIs
- **`FixtureToolExecutor`** (`lib/mcp/fixture-executor.ts`) - Eval implementation returning fixture data
- **Eval Runner** (`evals/lib/runner.ts`) - Standalone eval execution engine (no bun:test dependency)

### Adding New Eval Cases

1. Create a case file in `evals/cases/EC-###.md` with the user prompt
2. Add the case to `evals/registry.json` (minimal format - only include fields with values)
3. Optionally create `evals/fixtures/EC-###/overrides.json` for case-specific data
4. Run with `EVAL_IDS="EC-###" EVAL_FIXTURES=1 bun run evals`

### Registry Format (v3.0)

Registry uses a minimal format where empty fields are omitted. Defaults are applied when loaded:

```json
{
  "id": "EC-086",
  "title": "Scenario title",
  "category": "policy",
  "tags": ["policy"],
  "expected_schema": ["diagnosis", "evidence", "hypotheses", "next_steps"],
  "required_evidence": ["key", "terms"],
  "required_tool_calls": ["getChromeEvents"]
}
```

### Running Evals

```bash
# With fixture injection (recommended, server auto-starts)
EVAL_FIXTURES=1 bun run evals

# Specific cases
EVAL_IDS="EC-071,EC-072" EVAL_FIXTURES=1 bun run evals

# Test mode (no AI calls)
EVAL_TEST_MODE=1 bun run evals
```

### CLI Options

The eval runner supports advanced options via CLI flags:

```bash
# Generate HTML report
EVAL_FIXTURES=1 bun run evals --html

# With LLM judge scoring
EVAL_FIXTURES=1 bun run evals --with-judge

# Multiple iterations (identifies flaky tests)
EVAL_FIXTURES=1 bun run evals --iterations 3

# Full run (judge + 3 iterations + HTML + analysis)
EVAL_FIXTURES=1 bun run evals:full

# Specific cases via CLI
bun run evals --cases EC-001,EC-002
```

Reports saved to `evals/reports/` (JSON + HTML).

## When Oxlint + Oxfmt Can't Help

Oxlint + Oxfmt's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Oxlint + Oxfmt can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Oxlint + Oxfmt. Run `bun x ultracite fix` before committing to ensure compliance.
