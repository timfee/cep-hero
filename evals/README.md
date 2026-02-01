# CEP evals

This directory holds eval definitions and run artifacts for the CEP assistant.
If you are new to AI evals, think of each eval as a short, well-defined
scenario that checks whether the assistant responds in the right shape and with
the right evidence.

## What is an eval

An eval is a behavior check for a scenario. It answers a simple question: given
this input, do we get a response with the right diagnosis, evidence, and next
steps? It is not a unit test of a function. It is a contract for expected
behavior.

## What is a test

Tests run the evals. They read the registry, call `/api/chat`, and enforce the
response contract. Tests are grouped by category so you can run a small slice
fast.

## Structure

- `registry.json` contains the source of truth for all evals.
- `cases/` contains one Markdown file per eval case.
- `fixtures/` contains deterministic log samples and API snapshots.
- `reports/` contains JSON output per run (gitignored).

## Running evals

Start the server once:

```bash
bun run dev
```

Then run evals without server management:

```bash
bun run evals:run
bun run evals:run:diag:fast
bun run evals:run:plan:fast
EVAL_USE_FIXTURES=1 bun run evals:run:common:fast
```

Run a single eval:

```bash
EVAL_IDS=EC-075 bun run evals:run:by-id
```

Run by tag or pattern:

```bash
EVAL_TAGS=dlp,connectors bun run evals:run:by-tag
TEST_PATTERN="EC-0(1|2|3)" bun run evals:run:pattern
```

## Gates (configurable)

Strict gates fail the run. Warning gates only log.

- `EVAL_STRICT_EVIDENCE=1` enforces required evidence.
- `EVAL_RUBRIC_STRICT=1` enforces rubric minimums.
- `EVAL_WARN_MISSING_EVIDENCE=1` logs evidence gaps.
- `EVAL_WARN_RUBRIC=1` logs rubric gaps.
- `EVAL_USE_FIXTURES=1` attaches fixture text to prompts.
- `EVAL_USE_BASE=1` attaches the base API snapshot.

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
3. Run it in isolation: `EVAL_IDS=EC-### bun run test:eval-id`.
