# Manual Eval Testing Guide

This guide explains how to manually run evals and report results for AI-assisted development sessions.

## Prerequisites

1. Node.js/Bun installed
2. Dependencies installed: `bun install`
3. Environment variables configured (especially `GOOGLE_GENERATIVE_AI_API_KEY`)

## Quick Start

### Terminal 1: Start the Dev Server

```bash
# Start on port 3100 (required for evals)
bun run dev --port 3100
```

Wait for "Ready" message before proceeding.

### Terminal 2: Run Evals

```bash
# Run a single eval
EVAL_IDS="EC-001" EVAL_USE_FIXTURES=1 bun run evals

# Run multiple specific evals
EVAL_IDS="EC-001,EC-002,EC-004" EVAL_USE_FIXTURES=1 bun run evals

# Run all enrollment evals
EVAL_CATEGORY="enrollment" EVAL_USE_FIXTURES=1 bun run evals

# Run with verbose output
EVAL_VERBOSE=1 EVAL_IDS="EC-001" EVAL_USE_FIXTURES=1 bun run evals
```

## Environment Variables

| Variable               | Description                                          |
| ---------------------- | ---------------------------------------------------- |
| `EVAL_IDS`             | Comma-separated case IDs (e.g., `EC-001,EC-002`)     |
| `EVAL_CATEGORY`        | Filter by category (e.g., `enrollment`, `connector`) |
| `EVAL_TAGS`            | Filter by tags                                       |
| `EVAL_LIMIT`           | Max number of cases to run                           |
| `EVAL_USE_FIXTURES=1`  | Enable fixture injection (recommended)               |
| `EVAL_VERBOSE=1`       | Show detailed output                                 |
| `EVAL_SERIAL=1`        | Run sequentially instead of parallel                 |
| `EVAL_MANAGE_SERVER=0` | Skip auto server management (use with manual server) |
| `EVAL_LLM_JUDGE=0` | Disable LLM-as-judge for evidence evaluation (enabled by default) |
| `EVAL_INJECT_PROMPT=1` | Inject fixtures into prompt instead of returning via tool calls |

## Reporting Results

After running evals, report these details:

### 1. Summary Output

Copy the summary block from terminal output:

```
════════════════════════════════════════════════════════════
EVAL RUN SUMMARY
════════════════════════════════════════════════════════════
Run ID:    2026-02-02T23-57-37-477Z
Duration:  14990ms
Total:     X cases
Passed:    X
Failed:    X
Errors:    X
...
```

### 2. For Failed Cases

If any cases fail, include:

- Case ID and error message
- The `responseText` from the report file (in `evals/reports/`)

Example:

```bash
# View a specific report
cat evals/reports/EC-001-*.json | jq '{caseId, status, error, responseText}'
```

### 3. AI Response Sample

For debugging response format issues, include a sample of what the AI actually returned:

```bash
cat evals/reports/EC-001-*.json | jq -r '.responseText' | head -50
```

## Fixture Categories to Test

Current fixtures are available for:

| Category   | Case IDs                                               | Status |
| ---------- | ------------------------------------------------------ | ------ |
| enrollment | EC-001, EC-002, EC-004, EC-018, EC-046, EC-069, EC-070 | Ready  |
| events     | EC-052, EC-062                                         | Ready  |
| extensions | EC-043, EC-044, EC-045, EC-053                         | Ready  |

## LLM-as-Judge (Semantic Evidence Evaluation)

By default, the eval runner uses an LLM to evaluate evidence requirements semantically. This handles:
- Synonyms: "wifi" matches "Wi-Fi", "wireless network"
- Paraphrasing: "deauth" matches "disconnection", "handshake timeout"
- Semantic equivalence: Error codes can be explained rather than quoted

How it works:
1. String matching runs first (with normalization for hyphens, case, etc.)
2. Cases that fail string matching are batched and sent to Gemini
3. LLM evaluates if the response semantically addresses each evidence concept
4. Failures are upgraded to passes if the LLM determines evidence is present

To disable LLM judging (use strict string matching only):
```bash
EVAL_LLM_JUDGE=0 EVAL_CATEGORY="enrollment" bun run evals
```

## Tool Call Validation

Evals can validate that the AI calls specific tools during troubleshooting. This is controlled by the `required_tool_calls` field in registry.json.

**What gets checked:**
- Tool names are captured from streaming response events
- Required tools are validated after the response completes
- Missing tools cause the eval to fail

**Example report output:**
```json
{
  "toolCallsResult": {
    "passed": false,
    "message": "Missing required tool calls: getChromeEvents"
  },
  "toolCalls": ["suggestActions"]
}
```

**Why this matters:**
- The system prompt instructs the AI to always call `getChromeEvents` first
- This validates that behavior is actually followed
- Catches cases where the AI gives generic advice without checking data

## Troubleshooting

### "Cannot connect to API" errors

- Verify `GOOGLE_GENERATIVE_AI_API_KEY` is set
- Check network connectivity to `generativelanguage.googleapis.com`

### "Response missing expected schema" errors

- The AI response format doesn't match expected structure
- Check `responseText` in the report to see what was returned
- May need to adjust system prompt in `lib/chat/chat-service.ts`

### Server not responding

- Ensure dev server is running on port 3100
- Check for port conflicts: `lsof -i:3100`

## Example Full Workflow

```bash
# Terminal 1
bun run dev --port 3100

# Terminal 2 - Run enrollment evals
EVAL_CATEGORY="enrollment" EVAL_USE_FIXTURES=1 EVAL_VERBOSE=1 bun run evals

# Check specific failure
cat evals/reports/EC-001-*.json | jq '{caseId, status, error}'

# Get full response for debugging
cat evals/reports/EC-001-*.json | jq -r '.responseText'
```
