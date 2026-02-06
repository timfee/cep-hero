# EC-087: Check if safe browsing is properly configured

## Summary

Administrator asks whether safe browsing is properly configured. The system should run diagnostic tools and provide a clear answer with evidence.

## Reproduction

1. User asks "Check if safe browsing is properly configured"
2. System should call getChromeConnectorConfiguration to inspect policies
3. System should report findings with specific evidence about safe browsing status

## Conversation

User: "Check if safe browsing is properly configured"

## Expected result

- System calls getChromeConnectorConfiguration to check current state.
- Response mentions safe browsing status with specific evidence from connector policies.
- No internal tool names appear in the response text.
- No clarifying questions asked.

## Cleanup

- None.
