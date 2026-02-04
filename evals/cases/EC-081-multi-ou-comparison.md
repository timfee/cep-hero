# EC-081: Multi-OU comparison

## Summary

Connector coverage differs between two OUs and must be compared.

## Reproduction

1. Create OUs `Engineering-Test` and `Sales-Test` with users in each.
2. Apply connectors only to Engineering.
3. Ask which OU is missing coverage.

## Conversation

User: “Compare connector coverage for Engineering-Test vs Sales-Test.”

## Expected result

- Diagnosis identifies the OU missing connector coverage.
- Evidence includes resolved policies per OU.
- Next steps suggest applying connectors to the missing OU.

## Cleanup

- Remove policies, delete users and OUs.
