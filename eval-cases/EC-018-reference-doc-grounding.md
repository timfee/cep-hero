# EC-018: Reference doc grounding

## Summary

The assistant should ground answers with a single reference when docs are
available.

## Reproduction

1. Ensure documentation sources are indexed.
2. Ask for a Chrome DLP reference.
3. Verify a single reference line is returned.

## Conversation

User: “Show me Chrome DLP reference for this issue.”

## Expected result

- Response includes a single Reference line with title and URL.
- No extra references are appended.

## Cleanup

- None.
