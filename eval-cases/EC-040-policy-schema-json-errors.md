# EC-040: Policy schema JSON errors

## Summary

Policies fail silently because JSON payloads are invalid or do not match schema.

## Reproduction

1. Set an invalid JSON blob for a policy (e.g., ExtensionSettings).
2. Observe policy errors in chrome://policy or audit logs.
3. Ask why the policy does not apply.

## Conversation

User: “Why is the ExtensionSettings policy ignored?”

## Expected result

- Diagnosis points to validation or schema errors.
- Evidence includes policy error state or audit log event.
- Next steps advise JSON validation and schema alignment.

## Cleanup

- Fix or remove invalid policy JSON.
