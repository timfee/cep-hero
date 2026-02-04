# CEP Evals

Behavioral tests for the CEP diagnostic assistant. Each eval checks if the assistant produces the expected diagnosis, evidence, and recommendations for a given scenario.

## Quick Start

```bash
# Run all evals with fixture data (server auto-starts)
EVAL_FIXTURES=1 bun run evals

# Run specific case
EVAL_IDS=EC-001 EVAL_FIXTURES=1 bun run evals

# Run by category or tag
EVAL_CATEGORY=connector EVAL_FIXTURES=1 bun run evals
EVAL_TAGS=dlp EVAL_FIXTURES=1 bun run evals
```

The runner automatically manages the dev server (starts on port 3100, stops when done).

## Structure

```
evals/
├── registry.json       # Case definitions (87 cases across 15 categories)
├── cases/              # Markdown files with prompts and expected results
├── fixtures/
│   ├── base/           # Shared API snapshot (api-base.json)
│   └── EC-###/         # Per-case overrides (overrides.json)
├── lib/                # Runner implementation
└── reports/            # JSON + HTML output (gitignored)
```

## Environment Variables

| Variable                  | Purpose                                        |
| ------------------------- | ---------------------------------------------- |
| `EVAL_FIXTURES=1`         | Enable fixture data (base + overrides + files) |
| `EVAL_IDS=EC-001,EC-002`  | Run specific cases                             |
| `EVAL_CATEGORY=connector` | Filter by category                             |
| `EVAL_TAGS=dlp`           | Filter by tag                                  |
| `EVAL_SERIAL=1`           | Run sequentially (for rate limiting)           |
| `EVAL_LLM_JUDGE=0`        | Disable semantic evidence matching             |
| `EVAL_VERBOSE=1`          | Detailed output                                |
| `EVAL_TEST_MODE=1`        | Synthetic responses (no API calls)             |

## Registry Format (v3.0)

Cases are defined in `registry.json` with a minimal format. Empty fields are omitted:

```json
{
  "id": "EC-086",
  "title": "Scenario title",
  "category": "policy",
  "tags": ["relevant", "tags"],
  "expected_schema": ["diagnosis", "evidence", "hypotheses", "next_steps"],
  "required_evidence": ["key", "terms"],
  "forbidden_evidence": ["powerwash", "factory reset"],
  "required_tool_calls": ["getChromeEvents"],
  "reference_response": "The issue is caused by..."
}
```

**Assertion fields:**

- `required_evidence` - Terms that MUST appear in the response
- `forbidden_evidence` - Terms that must NOT appear (negative test cases)
- `required_tool_calls` - Tools that must be called
- `reference_response` - Golden response for comparison (optional)

Optional fields are normalized with defaults when loaded:

- `mode` defaults to `"deterministic"`
- `source_refs`, `tags`, `expected_schema` default to `[]`
- `case_file` defaults to `evals/cases/{id}.md`

## Adding a Case

1. Create `evals/cases/EC-###.md`:

```markdown
# EC-086: Scenario title

## Summary

Brief description.

## Conversation

User: "The exact prompt"

## Expected result

- What diagnosis should identify
- What evidence should reference
- What next steps should recommend
```

2. Add to `registry.json` (only include fields with values):

```json
{
  "id": "EC-086",
  "title": "Scenario title",
  "category": "policy",
  "tags": ["policy"],
  "expected_schema": ["diagnosis", "evidence", "hypotheses", "next_steps"],
  "required_evidence": ["key", "terms"]
}
```

3. Optionally add `evals/fixtures/EC-086/overrides.json`.

4. Run and iterate:

```bash
EVAL_IDS=EC-086 EVAL_FIXTURES=1 bun run evals
```

## CLI Options

The eval runner supports CLI flags for advanced features:

```bash
# Show help
bun run evals --help

# Generate HTML report
EVAL_FIXTURES=1 bun run evals --html

# Run with LLM judge
EVAL_FIXTURES=1 bun run evals --with-judge

# Multiple iterations (detects flaky tests)
EVAL_FIXTURES=1 bun run evals --iterations 3

# Run Gemini analysis on results
EVAL_FIXTURES=1 bun run evals --analyze

# Full run (judge + 3 iterations + HTML + analysis)
EVAL_FIXTURES=1 bun run evals:full

# Filter to specific cases via CLI
bun run evals --cases EC-001,EC-002
```

Reports are saved to `evals/reports/`.

## Evidence Matching

Evidence is checked in two phases:

1. **String matching** - Normalized text search (handles wifi/Wi-Fi variations)
2. **LLM judge** - Semantic evaluation for cases that fail string matching

The LLM judge handles synonyms ("deauth" ↔ "deauthentication") and paraphrasing. Disable with `EVAL_LLM_JUDGE=0`.

## When an Eval Fails

Check `evals/reports/EC-###-*.json` for details, then:

1. **Is the AI response actually wrong?**
   - Missing data → Improve fixtures
   - Wrong reasoning → Improve system instructions
   - Missing capability → Improve tools

2. **Is the eval too strict?**
   - Loosen `required_evidence` terms
   - Accept alternative valid phrasings

Don't loosen requirements just to make tests pass - that defeats the purpose.

## Fixture Data

Fixtures provide deterministic test data:

- **Base snapshot** (`fixtures/base/api-base.json`) - Shared org units, policies, events
- **Case overrides** (`fixtures/EC-###/overrides.json`) - Case-specific data merged with base

### Capturing Fresh Fixtures

To regenerate the base snapshot from live Google APIs:

```bash
bun run fixtures:capture
```

**Requirements:**

- `GOOGLE_SERVICE_ACCOUNT_JSON` - Service account credentials with Admin SDK access
- `GOOGLE_TOKEN_EMAIL` - Email for domain-wide delegation impersonation
- `GOOGLE_CUSTOMER_ID` - Google Workspace customer ID

**What it captures:**

- Org units (first 10)
- Policy schemas (first 10)
- Chrome management reports
- Audit events sample

**PII Redaction:** The script automatically redacts emails, customer IDs, IP addresses, file paths, and hashes before writing fixtures.
