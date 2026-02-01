# EC-065: Web Data Connector missing

## Summary

Web data connector is unset or disabled for the OU.

## Reproduction

1. Create OU `Web-Off` and a user.
2. Leave WebDataConnectorEnabled unset or false.
3. Ask why web data export is blocked.

## Conversation

User: “Why can’t testuser6@ export web data?”

## Expected result

- Diagnosis identifies missing or disabled web connector policy.
- Evidence includes resolved connector settings.
- Next steps recommend enabling it at the OU.

## Cleanup

- Remove policy, delete user and OU.
