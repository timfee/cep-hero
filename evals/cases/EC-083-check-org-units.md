# EC-083: Check Org Units

## Summary

Verify that the "Check org units" action successfully lists organizational units using the newly implemented tool.

## Reproduction

1. Ask the agent to "Check org units".

## Conversation

User: "Check org units"

## Expected result

- Tool `listOrgUnits` is called.
- Response contains a list of Org Units or a confirmation that they were checked.
