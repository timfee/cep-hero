# HERO-001: DLP Audit Rule Creation

## Description

Multi-turn hero workflow to create a DLP audit rule for all traffic.

## Conversation

**User (Turn 0):** Look at your DLP - let's make an audit rule for all traffic

**User (Turn 1):** Confirm

## Expected Behavior

### Turn 0

- AI should call `listDLPRules` to check existing rules
- AI should call `draftPolicyChange` to propose the new DLP audit rule
- Response should explain what DLP rules are configured and propose creating an audit rule

### Turn 1

- AI should call `createDLPRule` or `applyPolicyChange` to create the rule
- Response should confirm the rule was created successfully

## Success Criteria

- All required tool calls made per turn
- Clear explanation of the DLP configuration
- Successful rule creation on confirmation
