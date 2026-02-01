# EC-056: API quota exhaustion

## Summary
Eval tooling hits API rate limits due to aggressive polling.

## Reproduction
1. Trigger HTTP 429 responses from Admin SDK.
2. Capture Retry-After headers.
3. Ask how to handle quota exhaustion.

## Conversation
User: “We hit API quota limits while running diagnostics.”

## Expected result
- Diagnosis references 429 and quota exhaustion.
- Evidence includes Retry-After header or API error.
- Next steps recommend exponential backoff or event-driven design.

## Cleanup
- None.
