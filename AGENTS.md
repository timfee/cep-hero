# CEP Hero Code Standards

This document serves as the canonical reference for AI agents (Claude, Gemini, etc.) working with this codebase. It defines coding standards, architectural patterns, and best practices.

## Quick Reference

```bash
bun x ultracite fix    # Format code
bun x ultracite check  # Check for issues
bun test               # Run tests
```

---

## Project Architecture

### Core Patterns

This codebase enforces several key architectural patterns:

1. **Discriminated Unions for API Results** - Use `ApiResult<T>` from `lib/mcp/errors.ts`
2. **Unified Logging** - Use `logApiRequest`, `logApiResponse`, `logApiError` from `lib/mcp/errors.ts`
3. **Shared Constants** - Common values in `lib/mcp/constants.ts`
4. **Direct Imports** - Avoid barrel files; import from source files directly
5. **Type Guards** - Use type narrowing over type assertions

### API Result Pattern

All API operations should use the unified `ApiResult<T>` type:

```typescript
import { type ApiResult, ok, err, isSuccess, isError } from "@/lib/mcp/errors";

// Return success
return ok({ events: items, nextPageToken: null });

// Return error
return err("API unavailable", "Check API enablement", false);

// Check result
if (isSuccess(result)) {
  // result.data is typed
}
if (isError(result)) {
  // result.error, result.suggestion, result.requiresReauth available
}
```

### Logging Pattern

Use the unified logging utilities for consistent structured output:

```typescript
import { logApiRequest, logApiResponse, logApiError } from "@/lib/mcp/errors";

logApiRequest("chrome-events", { maxResults, pageToken });
logApiResponse("chrome-events", { count: items.length });
logApiError("chrome-events", error);
```

### Constants

Extract magic numbers and shared values to `lib/mcp/constants.ts`:

```typescript
import { MS_PER_DAY, CONNECTOR_POLICY_SCHEMAS } from "@/lib/mcp/constants";

const windowStart = new Date(windowEnd.getTime() - windowDays * MS_PER_DAY);
```

---

## Anti-Patterns to Avoid

### DO NOT:

1. **Create barrel files** - Import directly from source files, not index.ts re-exports
2. **Define duplicate types** - Reuse types from `lib/mcp/types.ts` and `lib/mcp/errors.ts`
3. **Wrap functions unnecessarily** - If a wrapper adds no logic, import the original
4. **Use `"error" in result`** - Use the `isSuccess`/`isError` type guards instead
5. **Define constants multiple times** - Add shared constants to `lib/mcp/constants.ts`
6. **Create overly granular functions** - 4-6 line helpers add cognitive overhead
7. **Use defensive checks on typed values** - Trust TypeScript types

### Examples:

```typescript
// BAD: Barrel import
import { Something } from "@/lib/mcp";

// GOOD: Direct import
import { Something } from "@/lib/mcp/types";

// BAD: Duplicate constant
const MS_IN_DAY = 86_400_000;

// GOOD: Shared constant
import { MS_PER_DAY } from "@/lib/mcp/constants";

// BAD: Check for property existence
if ("error" in result) { ... }

// GOOD: Type guard
if (isError(result)) { ... }
```

---

## Documentation Standards (JSDoc)

### File-Level

Every TypeScript file MUST begin with a JSDoc comment:

```typescript
/**
 * Chrome audit event fetching from Admin SDK Reports API.
 */
```

### Function Documentation

Exported functions and class methods MUST have JSDoc:

```typescript
/**
 * Formats a Cloud Identity setting type into a human-readable name.
 */
export function formatSettingType(settingType: string) {
```

**Rules:**

- Multi-line format with `/**` on its own line
- Description only - NO `@param` or `@return` tags (TypeScript provides this)
- Explain "why" not "what" when the function name is obvious

### Type Documentation

Exported types, interfaces, and type aliases MUST have JSDoc:

```typescript
/**
 * Result from fetching Chrome audit events.
 */
export type ChromeEventsResult = ChromeEventsSuccess | ChromeEventsError;
```

---

## Type Safety

- Use explicit types for function parameters and return values
- Prefer `unknown` over `any`
- Use `as const` for immutable values and literal types
- Use type narrowing (type guards) over type assertions
- Extract magic numbers to named constants

---

## Modern TypeScript

- Arrow functions for callbacks
- `for...of` over `.forEach()` and indexed loops
- Optional chaining (`?.`) and nullish coalescing (`??`)
- Template literals over string concatenation
- Destructuring for object/array assignments
- `const` by default, `let` when needed, never `var`

---

## Async Code

- Always `await` promises in async functions
- Use `async/await` over promise chains
- Handle errors with try-catch
- Don't use async functions as Promise executors
- Return values directly in async functions (no `Promise.resolve` wrapper)

---

## React & JSX

- Function components over class components
- Hooks at top level only, never conditionally
- Complete dependency arrays in hooks
- Unique `key` props (prefer IDs over indices)
- Semantic HTML and ARIA attributes for accessibility
- Don't define components inside other components

---

## Error Handling

- Structured `console.log` with tags: `[chrome-events] error`
- Use `logApiError()` for consistent formatting
- Throw `Error` objects, not strings
- Use try-catch meaningfully
- Early returns over nested conditionals

---

## Testing

```bash
bun install            # Install dependencies
bun test               # Run all tests
bun test tests/        # Run specific directory
bun x ultracite check  # Lint
```

### Framework

- **Runtime**: Bun's test runner (`bun:test`)
- **Browser APIs**: happy-dom
- **React Testing**: `@testing-library/react`

### Best Practices

- Assertions inside `it()` or `test()` blocks
- `async/await` over done callbacks
- No `.only` or `.skip` in committed code
- Flat test structure

---

## Environment Variables

Variables may contain surrounding quotes that need stripping:

```typescript
value.replace(/^['"]|['"]$/g, "");
```

**Common vars needing quote handling:**

- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `GOOGLE_TOKEN_EMAIL`
- `GOOGLE_CUSTOMER_ID`

---

## Evaluation Framework

See `evals/README.md` for full documentation.

```bash
EVAL_USE_BASE=1 bun run evals              # Run with fixtures
EVAL_IDS="EC-071" EVAL_USE_BASE=1 bun run evals  # Specific case
bun run evals:comprehensive --skip-analysis      # Full run
```

---

## Directory-Specific Guidance

- **`app/`** - Next.js routes and pages. See `app/AGENTS.md`
- **`lib/`** - Core business logic. See `lib/AGENTS.md`
- **`components/`** - React components. See `components/AGENTS.md`
- **`tests/`** - Test utilities. See `tests/AGENTS.md`
- **`evals/`** - Evaluation framework. See `evals/README.md`
- **`types/`** - Shared type definitions. See `types/AGENTS.md`

---

## Before Committing

```bash
bun x ultracite fix    # Auto-fix formatting
bun x ultracite check  # Verify no issues
bun test               # Run tests
```
