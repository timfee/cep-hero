# Manual Eval Testing

This guide covers steady-state manual eval runs and how to capture results.

## Prerequisites

1. Bun installed
2. Dependencies installed: `bun install`
3. Environment variables set (especially `GOOGLE_GENERATIVE_AI_API_KEY`)

## Run Evals

Start the dev server (required for evals):

```bash
bun run dev --port 3100
```

Run evals in a separate terminal:

```bash
# Single case
EVAL_IDS="EC-001" EVAL_USE_FIXTURES=1 bun run evals

# Category
EVAL_CATEGORY="enrollment" EVAL_USE_FIXTURES=1 bun run evals

# Verbose output
EVAL_VERBOSE=1 EVAL_IDS="EC-001" EVAL_USE_FIXTURES=1 bun run evals
```

## Useful Environment Flags

| Variable               | Description                                                     |
| ---------------------- | --------------------------------------------------------------- |
| `EVAL_IDS`             | Comma-separated case IDs (e.g., `EC-001,EC-002`)                |
| `EVAL_CATEGORY`        | Filter by category (e.g., `enrollment`, `connector`)            |
| `EVAL_TAGS`            | Filter by tags                                                  |
| `EVAL_LIMIT`           | Max number of cases to run                                      |
| `EVAL_USE_FIXTURES=1`  | Enable fixture injection (recommended)                          |
| `EVAL_VERBOSE=1`       | Show detailed output                                            |
| `EVAL_SERIAL=1`        | Run sequentially instead of parallel                            |
| `EVAL_MANAGE_SERVER=0` | Skip auto server management                                     |
| `EVAL_LLM_JUDGE=0`     | Disable LLM-as-judge for evidence evaluation                    |
| `EVAL_INJECT_PROMPT=1` | Inject fixtures into prompt instead of returning via tool calls |

## Reviewing Results

1. Check the summary in terminal output.
2. For failures, open the report in `evals/reports/` and inspect `error` and `responseText`.

Example:

```bash
cat evals/reports/EC-001-*.json | jq '{caseId, status, error, responseText}'
```

## Troubleshooting

### Cannot connect to API

- Verify `GOOGLE_GENERATIVE_AI_API_KEY` is set
- Check network connectivity to `generativelanguage.googleapis.com`

### Response missing expected schema

- Inspect `responseText` in the report
- Adjust system prompt or schema in `lib/chat/chat-service.ts` if needed

### Server not responding

- Confirm the dev server is running on port 3100
- Check for port conflicts: `lsof -i:3100`
