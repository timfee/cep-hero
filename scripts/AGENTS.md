# Scripts Directory

See the root [AGENTS.md](../AGENTS.md) for project-wide coding standards.

## Scope

CLI utilities for indexing, validation, testing, and code generation.

## Scripts

- **`check-env.ts`** - Validate environment variable configuration
- **`check-credentials.ts`** - Test Google API credentials and permissions
- **`validate-dlp-api.ts`** - Validate DLP API access (Cloud Identity v1beta1)
- **`test-email.ts`** - Email address validation testing
- **`capture-eval-fixtures.ts`** - Capture live API data into eval fixture files (redacts PII)
- **`live-test-multi.ts`** - Multi-turn chat flow tests simulating real user interactions (DLP lifecycle, policy drafts, citations, safe browsing)
- **`index-policies.ts`** - Index Chrome policy schemas into vector store
- **`index-helpcenter.ts`** - Index Google Help Center articles
- **`index-cloud.ts`** - Index Cloud Identity resources
- **`policy-types.ts`** - Chrome policy type extraction
- **`vector-types.ts`** - Vector database schema generation
- **`fix-env-json.ts`** - Repair malformed JSON in environment variables
- **`utils.ts`** - Shared script utilities

## Guidelines

- Keep scripts deterministic and idempotent
- Do not hand-edit generated outputs; update the source script
- Log progress with concise, structured messages

## Live Testing

`live-test-multi.ts` runs multi-turn conversation flows against a running server and validates:

- Tool call patterns (correct tools invoked)
- Citation presence (inline markdown links and Sources headings)
- Response quality (no tool name leaks, no unnecessary questions)
- Each flow is scored PASS/FAIL with detailed metrics

## Helpcenter Indexing

- 429s usually mean stale headers or missing corp session
- Refresh headers from `support.google.com` and update `scripts/index-helpcenter.ts`
