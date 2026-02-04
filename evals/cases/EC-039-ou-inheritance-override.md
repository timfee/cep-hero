# EC-039: OU inheritance override

## Summary

An unexpected policy is caused by a sub-OU override or missing inheritance.

## Reproduction

1. Set a policy at root OU.
2. Override it in a child OU.
3. Ask which setting is effective for the child OU.

## Conversation

User: “Why does this OU not inherit the root policy?”

## Expected result

- Diagnosis identifies the OU where the override was set.
- Evidence includes resolve response sourceKey.
- Next steps instruct resetting to inherit or adjusting the override.

## Cleanup

- Restore original policy inheritance.
