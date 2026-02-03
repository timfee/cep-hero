# CEP evals

This directory holds eval definitions and run artifacts for the CEP assistant. Each eval is a short, well-defined scenario that checks whether the assistant responds in the right shape and with the right evidence.

## What is an eval

An eval is a behavior check for a scenario. It answers a simple question: given this input, do we get a response with the right diagnosis, evidence, and next steps? It is not a unit test of a function. It is a contract for expected behavior.

## What is a test

Tests (in `tests/` directory) verify code correctness with deterministic outcomes. Evals (here) assess AI behavior quality along multiple dimensions.

## Structure

- `registry.json` - Source of truth for all 85 eval cases, organized by 15 failure-domain categories
- `cases/` - One Markdown file per eval case (EC-001 through EC-085)
- `fixtures/` - Deterministic log samples and API snapshots
- `lib/` - Standalone eval runner (no bun:test dependency)
- `reports/` - JSON output per run (gitignored)

## Running evals

Start the server once:

```bash
bun run dev
```

Then run evals:

```bash
# Run all evals
EVAL_USE_BASE=1 bun run evals

# Run without server management (faster if server already running)
EVAL_USE_BASE=1 bun run evals:fast

# Run with verbose output
EVAL_USE_BASE=1 bun run evals:verbose
```

Run a single eval:

```bash
EVAL_IDS=EC-075 EVAL_USE_BASE=1 bun run evals
```

Run by category or tag:

```bash
EVAL_CATEGORY=connector EVAL_USE_BASE=1 bun run evals
EVAL_TAGS=dlp EVAL_USE_BASE=1 bun run evals
```

## Environment variables

- `EVAL_USE_BASE=1` - Load base fixtures from `evals/fixtures/base/api-base.json`
- `EVAL_USE_FIXTURES=1` - Load case-specific overrides from `evals/fixtures/EC-###/`
- `EVAL_IDS=EC-001,EC-002` - Run specific eval IDs
- `EVAL_CATEGORY=connector` - Run evals in a category
- `EVAL_TAGS=dlp` - Run evals with specific tags
- `EVAL_LIMIT=10` - Maximum number of cases to run
- `EVAL_SERIAL=1` - Run cases sequentially (useful for rate limiting)
- `EVAL_MANAGE_SERVER=0` - Skip server lifecycle management
- `EVAL_VERBOSE=1` - Enable verbose output
- `EVAL_TEST_MODE=1` - Return synthetic responses (avoids quota/latency)
- `EVAL_LLM_JUDGE=0` - Disable LLM-as-judge for evidence evaluation
- `CHAT_URL` - Override chat API URL (default: `http://localhost:3100/api/chat`)

## Base snapshot + overrides

When `EVAL_USE_BASE=1` is set, the base snapshot is loaded and merged with any
per-case overrides before it is attached to the prompt. Overrides can come from
either of these sources:

- `overrides` in `registry.json` (paths to JSON override files).
- `evals/fixtures/EC-###/overrides.json` when present.

When `EVAL_USE_FIXTURES=1` is also set, the fixture files listed in the registry
are attached alongside the merged base snapshot.

## Fixture format

Fixtures are real samples, trimmed down. Keep them short and focused. If you
need JSON, store it as raw JSON lines so it is readable and easy to trim.

How to generate fixtures:

1. Reproduce the issue in a real environment.
2. Export the log (net-export, eventlog.txt, update_engine.log).
3. Redact secrets and PII (emails, tokens, device IDs).
4. Trim to the few lines that show the failure mode.
5. Save to `evals/fixtures/` and reference it in `registry.json`.

To capture a realistic base snapshot from live APIs:

```bash
bun run fixtures:capture
```

This writes `evals/fixtures/base/api-base.json` with org units, policy schemas,
and a small sample of Chrome reports and audit events. The script redacts
emails, customer IDs, IPs, and hashes. If a scope is missing, the fixture will
include an error field so you can see what failed.

Use the base snapshot in runs by setting:

```bash
EVAL_USE_BASE=1
```

Credential check (recommended before capture):

```bash
bun run credentials:check
```

Example `evals/fixtures/EC-019/net.log`:

```json
{"time":"2026-01-20T04:02:22.802Z","type":"DNS_REQUEST","params":{"hostname":"clients.google.com"}}
{"time":"2026-01-20T04:02:23.102Z","type":"SOCKET_CONNECT","params":{"address":"142.250.72.14","port":443}}
```

Example `evals/fixtures/EC-021/eventlog.txt`:

```text
2026-01-20T04:02:22.802Z wifi: deauth reason=15 (4-way handshake timeout) ssid=CorpNet signal=-72dBm
2026-01-20T04:02:24.402Z wifi: assoc status=17 (AP cannot support more stations)
```

Example `evals/fixtures/EC-003/update_engine.log`:

```text
2026-01-20T04:02:22.802Z update_engine: Update check failed (code=402 missing license)
2026-01-20T04:02:23.902Z update_engine: Target version policy is set to 119.0.6045.123
```

## Report format

Each run writes a report to `evals/reports/`. This is what you review when a
case fails or regresses.

Example (trimmed):

```json
{
  "caseId": "EC-019",
  "title": "Capturing network logs",
  "prompt": "How do I capture net logs for this issue?...",
  "responseText": "No connector policies are applied...",
  "schemaMatched": false,
  "status": "pass"
}
```

## LLM-as-Judge

By default, evidence evaluation uses an LLM to evaluate responses semantically. This solves the "whack-a-mole" problem of constantly adjusting evidence requirements.

**How it works:**
1. String matching with text normalization runs first (handles wifi/Wi-Fi variations)
2. Cases that fail string matching are batched and sent to Gemini
3. LLM evaluates if the response semantically addresses each evidence concept
4. Failures are upgraded to passes if the LLM determines evidence is present

**Why this matters:**
- "Wi-Fi" matches "wifi" (hyphen normalization)
- "4-way handshake timeout" matches "deauth" (semantic equivalence)
- No need to constantly tweak evidence requirements

**Disable with:** `EVAL_LLM_JUDGE=0`

## What to do when a result is wrong

When an eval fails, use this decision tree:

```
Eval Failed
    │
    ├── Is the AI response actually wrong?
    │   │
    │   ├── YES → The AI needs improvement
    │   │   │
    │   │   ├── Missing data? → Add/improve fixtures
    │   │   ├── Wrong reasoning? → Improve system instructions
    │   │   ├── Missing capability? → Add/improve tools
    │   │   └── Missing knowledge? → Add RAG content or enable web search
    │   │
    │   └── NO → The eval is too strict
    │       │
    │       ├── Loosen required_evidence terms
    │       ├── Accept alternative valid phrasings
    │       └── Review if the expected behavior is realistic
    │
    └── Is this a one-off or pattern?
        │
        ├── ONE-OFF → Fix this specific case
        │   └── Adjust fixture, prompt, or evidence requirements
        │
        └── PATTERN → Fix systemically
            └── Update system instructions, tools, or workflow
            └── Run full eval suite to verify fix doesn't break others
```

### Example walkthrough

EC-019 runs with fixtures and the response ignores `net-export`. The report
fails with missing evidence:

```json
{
  "caseId": "EC-019",
  "status": "fail",
  "error": "Missing required evidence: net-export",
  "responseText": "Capturing net logs will help diagnose the network issue..."
}
```

**Diagnosis**: The eval caught a real problem - the AI mentioned "net logs"
generically but didn't reference the specific `net-export` tool.

**Fix options** (in order of preference):

1. **Adjust the fixture** - Add explicit net-export data so the AI has something
   concrete to reference. Keep fixtures short so the model notices them.

2. **Adjust the prompt** - Make the case file prompt more specific: "The user
   has already captured a net-export log. Analyze it."

3. **Improve system instructions** - If this is a pattern (AI ignores provided
   logs), add general guidance about always referencing provided data.

4. **Tighten the eval** - If the AI should mention `net-export` but the evidence
   check is missing, add it to `required_evidence` in `registry.json`.

**Anti-pattern**: Don't loosen evidence requirements just to make the eval pass.
That defeats the purpose.

## When to add a new eval

Add a case when you:

- **Ship a new troubleshooting path** - Lock down the expected behavior before it regresses
- **Fix a bug** - Prevent the same failure mode from returning
- **See a customer failure** - Capture real-world scenarios
- **Identify a coverage gap** - Run the eval suite and notice missing scenarios

## How to add a new eval

**Step 1**: Create a case file in `cases/EC-###-descriptive-name.md`:

```markdown
# EC-086: Your scenario title

## Summary

Brief description of the troubleshooting scenario.

## Reproduction

1. Steps to reproduce the issue
2. What conditions trigger it
3. What the user observes

## Conversation

User: "The exact prompt the user would ask"

## Expected result

- What the diagnosis should identify
- What evidence should be referenced
- What next steps should be recommended

## Cleanup

- Any cleanup steps if using live data
```

**Step 2**: Add entry in `registry.json`:

```json
{
  "id": "EC-086",
  "title": "Your scenario title",
  "category": "policy",
  "source_refs": ["YourSource-1"],
  "case_file": "evals/cases/EC-086-your-scenario-title.md",
  "mode": "rubric",
  "tags": ["relevant", "tags"],
  "expected_schema": ["diagnosis", "evidence", "hypotheses", "next_steps"],
  "fixtures": [],
  "required_evidence": ["key", "terms"],
  "rubric": { "min_score": 2, "criteria": ["diagnosis", "evidence", "next"] }
}
```

**Step 3**: Optionally create fixtures in `evals/fixtures/EC-086/overrides.json`.

**Step 4**: Run in isolation and iterate:

```bash
EVAL_IDS=EC-086 EVAL_USE_BASE=1 bun run evals
```

## Iteration workflow

When working on an eval, use this tight feedback loop:

```bash
# Terminal 1: Keep server running
bun run dev

# Terminal 2: Run specific eval repeatedly
EVAL_IDS=EC-057 EVAL_USE_BASE=1 bun run evals:fast

# After changes, re-run immediately
# Check evals/reports/EC-057-*.json for detailed output
```

## Further reading

For comprehensive documentation including AI SDK patterns, loop control best
practices, and the full eval improvement roadmap, see:

- **[QUEST_INSTRUCTIONS.md](../QUEST_INSTRUCTIONS.md)** - Complete guide
- **[QUEST_TASKS.md](../QUEST_TASKS.md)** - Progress tracking
