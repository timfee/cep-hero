# HERO-002: Browser Security - Cookie Encryption + Disable Incognito

## Description

Multi-turn hero workflow to apply browser security policies: enable cookie encryption and disable incognito mode.

## Conversation

**User (Turn 0):** Apply cookie encryption and disable incognito mode for my fleet

**User (Turn 1):** Confirm

## Expected Behavior

### Turn 0

- AI should call `getChromeConnectorConfiguration` to check current policies
- AI should call `listOrgUnits` to identify target org units
- AI should call `draftPolicyChange` to propose the security policy changes
- Response should explain the current state and propose enabling cookie encryption + disabling incognito

### Turn 1

- AI should call `applyPolicyChange` to apply the changes
- Response should confirm the policies were applied successfully

## Success Criteria

- All required tool calls made per turn
- Clear explanation of the security changes
- Successful policy application on confirmation
