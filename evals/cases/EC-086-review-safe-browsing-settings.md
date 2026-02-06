# EC-086: Review safe browsing settings

## Summary

Administrator asks to review safe browsing settings. The system should immediately check connector configuration rather than asking clarifying questions, and should never expose internal tool names in the response.

## Reproduction

1. User asks "Review our safe browsing settings"
2. System should call getChromeConnectorConfiguration to check current state
3. System should summarize findings using natural language (no tool names)
4. System should suggest relevant follow-up actions related to safe browsing

## Conversation

User: "Review our safe browsing settings"

## Expected result

- System calls getChromeConnectorConfiguration without asking clarifying questions.
- Response describes safe browsing configuration in natural language.
- No internal tool names appear in the response text.
- Suggested follow-up actions are related to safe browsing, not unrelated topics like DLP.

## Cleanup

- None.
