# CEP Evals

Behavioral tests for the CEP diagnostic assistant. Each eval checks if the assistant produces the expected diagnosis, evidence, and recommendations for a given scenario.

## Quick Start

```bash
# Start server (required)
bun run dev

# Run all evals with fixture data
EVAL_USE_BASE=1 bun run evals

# Run specific case
EVAL_IDS=EC-001 EVAL_USE_BASE=1 bun run evals

# Run by category or tag
EVAL_CATEGORY=connector EVAL_USE_BASE=1 bun run evals
EVAL_TAGS=dlp EVAL_USE_BASE=1 bun run evals
```

## Structure

```
evals/
├── registry.json       # Case definitions (87 cases across 15 categories)
├── cases/              # Markdown files with prompts and expected results
├── fixtures/
│   ├── base/           # Shared API snapshot (api-base.json)
│   └── EC-###/         # Per-case overrides (overrides.json)
├── lib/                # Runner implementation
├── comprehensive/      # Multi-iteration runner with analysis
└── reports/            # JSON output (gitignored)
```

## Environment Variables

| Variable                  | Purpose                                  |
| ------------------------- | ---------------------------------------- |
| `EVAL_USE_BASE=1`         | Load base fixture snapshot (recommended) |
| `EVAL_IDS=EC-001,EC-002`  | Run specific cases                       |
| `EVAL_CATEGORY=connector` | Filter by category                       |
| `EVAL_TAGS=dlp`           | Filter by tag                            |
| `EVAL_SERIAL=1`           | Run sequentially (for rate limiting)     |
| `EVAL_LLM_JUDGE=0`        | Disable semantic evidence matching       |
| `EVAL_VERBOSE=1`          | Detailed output                          |
| `EVAL_TEST_MODE=1`        | Synthetic responses (no API calls)       |

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
  "required_tool_calls": ["getChromeEvents"]
}
```

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
EVAL_IDS=EC-086 EVAL_USE_BASE=1 bun run evals
```

## Comprehensive Runner

For multi-iteration runs with aggregated results:

```bash
# Basic run (skip Gemini analysis)
bun run evals:comprehensive --skip-analysis

# With LLM judge scoring
bun run evals:comprehensive --with-judge

# Multiple iterations (detects flaky tests)
bun run evals:comprehensive --iterations 3

# Full run
bun run evals:comprehensive:full
```

Outputs JSON and HTML reports to `evals/comprehensive/reports/`.

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

Generate a fresh base snapshot:

```bash
bun run fixtures:capture
```
