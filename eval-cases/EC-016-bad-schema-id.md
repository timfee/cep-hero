# EC-016: Bad schema ID

## Summary

Policy resolve returns zero results because the schema ID is invalid.

## Reproduction

1. Call resolve with a bogus schema ID.
2. Observe empty results.
3. Ask why no policies are returned.

## Conversation

User: “Policy resolve returned zero policies for schema id.”

## Expected result

- Diagnosis identifies incorrect schema ID.
- Evidence includes available schema list or expected IDs.
- Next steps provide the correct schema filter.

## Cleanup

- None.
