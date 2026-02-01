# EC-022: Outlook.com still blocked after removal

## Summary

Access remains blocked after policy removal due to propagation or caching.

## Reproduction

1. Remove the outlook.com block policy.
2. Ask again immediately about access.
3. Observe stale behavior.

## Conversation

User: “Outlook.com is still blocked after policy removal.”

## Expected result

- Diagnosis cites propagation delay or local cache.
- Evidence references recent policy change timestamps.
- Next steps advise waiting and re-checking policy sync.

## Cleanup

- Ensure block removed, delete user and OU if created.
