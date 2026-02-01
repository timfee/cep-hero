# EC-044: Permission increase blocking

## Summary

An extension update is blocked because it requests new permissions.

## Reproduction

1. Update an extension to a version with extra permissions.
2. Observe extension disabled or blocked.
3. Check EXTENSION_DISABLED logs.

## Conversation

User: “Why did the extension disable after updating?”

## Expected result

- Diagnosis cites permissions increase policy.
- Evidence includes audit log reason or policy settings.
- Next steps advise allowlisting or choosing another extension.

## Cleanup

- None.
