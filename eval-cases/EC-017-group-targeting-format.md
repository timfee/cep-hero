# EC-017: Group targeting format

## Summary

Connector policy targeting fails because the group targetResource format is
invalid.

## Reproduction

1. Create a group and add a user.
2. Apply policy with malformed group targetResource.
3. Ask why the group-scoped policy is ignored.

## Conversation

User: “Group-scoped connector ignored. What is correct targetResource format?”

## Expected result

- Diagnosis points to malformed targetResource.
- Evidence includes expected `groups/<id>` format.
- Next steps show correct group target.

## Cleanup

- Remove policy, delete group and user if created.
