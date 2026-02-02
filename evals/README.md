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
- `EVAL_MANAGE_SERVER=0` - Skip server lifecycle management
- `EVAL_VERBOSE=1` - Enable verbose output
- `EVAL_TEST_MODE=1` - Return synthetic responses (avoids quota/latency)

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

## What to do when a result is wrong

Example: EC-019 runs with fixtures and the response ignores `net-export`. The
report fails with missing evidence. That tells us the eval is working, not that
the assistant is correct.

Failing report (trimmed):

```json
{
  "caseId": "EC-019",
  "status": "fail",
  "error": "Missing required evidence: net-export",
  "responseText": "Capturing net logs will help diagnose the network issue..."
}
```

Fix options:

1. **Tighten the eval**
   - Add `required_evidence` terms in `registry.json` and run with
     `EVAL_STRICT_EVIDENCE=1`. If it fails, the response is out of spec.

2. **Adjust the fixture**
   - Add the exact log strings you expect the assistant to mention.
   - Keep fixtures short so the model is less likely to ignore them.

3. **Adjust the prompt**
   - Add a short note in the case file, such as “Use net-export and log-net-log”.

In short: if the assistant ignores the fixture, use strict evidence to catch
it, then refine the fixture or prompt to guide the response.

## When to add a new eval

Add a case when you ship a new troubleshooting path, fix a bug that should
never regress, or see a customer failure mode you want to lock down.

## How to add a new eval

1. Create a case file in `cases/` with an EC ID.
2. Add an entry in `registry.json` with tags, schema, and fixtures.
3. Run it in isolation: `EVAL_IDS=EC-### EVAL_USE_BASE=1 bun run evals`.
