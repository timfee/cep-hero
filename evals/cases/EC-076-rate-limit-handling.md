# EC-076: Rate limit handling

## Summary

Policy resolve or connector checks hit rate limits and return 429 errors.

## Reproduction

1. Trigger repeated resolve calls to induce a 429.
2. Ask why checks are rate-limited.
3. Confirm retry/backoff guidance.

## Conversation

User: “Connector check hit rate limit.”

## Expected result

- Diagnosis identifies API rate limiting.
- Evidence references 429 response or retry headers.
- Next steps recommend backoff and retry strategy.

## Cleanup

- None.
