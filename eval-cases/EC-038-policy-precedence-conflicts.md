# EC-038: Policy precedence conflicts

## Summary

Local platform policies override cloud policies due to precedence order.

## Reproduction

1. Set a cloud policy (e.g., extension blocklist).
2. Set conflicting local GPO policy to allow it.
3. Resolve policies and observe platform precedence.

## Conversation

User: “Why does the cloud policy not apply even though it’s set?”

## Expected result

- Diagnosis explains platform > cloud machine > cloud user precedence.
- Evidence includes resolve response sourceKey.
- Next steps recommend removing GPO or enabling overrides.

## Cleanup

- Revert local policy changes.
