# EC-005: Policies not applying (restart required vs invalid JSON)

## Summary

Policies do not apply because Chrome needs a restart or the policy JSON is
invalid.

## Reproduction

1. Apply a policy requiring restart to take effect.
2. Optionally set an invalid JSON for ExtensionSettings.
3. Ask why the policy is missing.

## Conversation

User: “Policies are set but devices aren’t picking them up.”

## Expected result

- Diagnosis distinguishes restart-required vs invalid JSON cases.
- Evidence references `chrome://policy` status or validation errors.
- Next steps recommend restart or JSON validation.

## Cleanup

- Fix or remove invalid JSON if used.
