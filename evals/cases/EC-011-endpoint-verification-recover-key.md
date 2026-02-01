# EC-011: Endpoint Verification cannot recover data protection key

## Summary

EV cannot recover the data protection key and fails to sync on Windows.

## Reproduction

1. Trigger key recovery failure.
2. Capture EV logs and registry state.
3. Ask for remediation steps.

## Conversation

User: “Endpoint Verification can’t recover the data protection key.”

## Expected result

- Diagnosis references DPAPI key recovery failure.
- Evidence includes EV logs or registry keys.
- Next steps advise resetting Safe Storage and updating Chrome.

## Cleanup

- None.
