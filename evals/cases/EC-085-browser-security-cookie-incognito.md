# EC-085: Browser security - cookie encryption and disable incognito

## Summary

Administrator wants to secure browsers by enabling cookie encryption and disabling incognito mode. The system should guide them through both configurations and provide actionable next steps.

## Reproduction

1. User asks to secure browsers with cookie encryption and disable incognito.
2. System should fetch current connector configuration to check existing policies.
3. System should propose policy changes using draftPolicyChange tool for both settings.
4. System should provide Admin Console deep links for manual configuration.

## Conversation

User: "I want to make our browsers more secure. Can you help me turn on cookie encryption and disable incognito mode?"

## Expected result

- Diagnosis explains both security features and their benefits.
- Evidence references current connector policies from getChromeConnectorConfiguration.
- System calls draftPolicyChange twice: once for cookie encryption, once for incognito mode.
- Next steps include Admin Console link to Chrome security settings (https://admin.google.com/ac/chrome/settings/security).
- Response explains what each setting does and why it improves security.

## Cleanup

- None.
