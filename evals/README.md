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
- `fixtures/` contains deterministic log samples for log-driven cases.
- `reports/` contains JSON output per run (gitignored).

## Running evals

Start the server once:

```bash
bun run dev
```

Then run evals without server management:

```bash
bun run test:evals:diag:fast
bun run test:evals:plan:fast
EVAL_USE_FIXTURES=1 bun run test:evals:common:fast
```

Run a single eval:

```bash
EVAL_IDS=EC-075 bun run test:eval-id
```

## Gates (configurable)

Strict gates fail the run. Warning gates only log.

- `EVAL_STRICT_EVIDENCE=1` enforces required evidence.
- `EVAL_RUBRIC_STRICT=1` enforces rubric minimums.
- `EVAL_WARN_MISSING_EVIDENCE=1` logs evidence gaps.
- `EVAL_WARN_RUBRIC=1` logs rubric gaps.
- `EVAL_USE_FIXTURES=1` attaches fixture text to prompts.

## Fixture format

Fixtures are plain text. Keep them short and focused. If you need JSON, store
it as raw JSON lines so it is readable and easy to trim.

Example `evals/fixtures/net.log`:

```json
{"time":"2026-01-20T04:02:22.802Z","type":"DNS_REQUEST","params":{"hostname":"clients.google.com"}}
{"time":"2026-01-20T04:02:23.102Z","type":"SOCKET_CONNECT","params":{"address":"142.250.72.14","port":443}}
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

Example: EC-019 runs with fixtures and the response ignores net logs. The
report showed missing evidence and a connector answer. That tells us the eval
is working, not that the assistant is correct.

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
