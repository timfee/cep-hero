# EC-080: Conflicting DLP vs connector

## Summary

DLP rules and connector settings conflict, allowing bulk exfiltration despite
expected blocks.

## Reproduction

1. Create OU `Conflict-Test` and a user.
2. Enable DLP rules and connectors that allow bulk exfil.
3. Ask why data still leaves via bulk connector.

## Conversation

User: “Data still leaving via bulk connector despite DLP rules.”

## Expected result

- Diagnosis highlights coverage or precedence gaps.
- Evidence references DLP rules and connector policy results.
- Next steps recommend tightening connector rules or adding DLP coverage.

## Cleanup

- Remove policies, delete user and OU.
