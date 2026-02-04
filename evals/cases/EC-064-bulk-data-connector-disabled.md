# EC-064: Bulk Data Connector disabled

## Summary

Bulk data connector is disabled, preventing bulk data protection actions.

## Reproduction

1. Create OU `Bulk-Off` and a user.
2. Set BulkDataConnectorEnabled=false.
3. Ask why bulk connector is not working.

## Conversation

User: “Bulk connector not working for testuser5@ — why?”

## Expected result

- Diagnosis identifies disabled bulk connector policy.
- Evidence references resolved connector setting.
- Next steps advise enabling the connector at the OU.

## Cleanup

- Remove policy, delete user and OU.
