# EC-009: Endpoint Verification sync failure (macOS Keychain)

## Summary

Endpoint Verification cannot sync because Keychain access blocks Safe Storage.

## Reproduction

1. Block Keychain access for Endpoint Verification.
2. Observe sync error.
3. Ask how to fix the sync failure.

## Conversation

User: “Endpoint Verification won’t sync on macOS due to Keychain errors.”

## Expected result

- Diagnosis references Keychain authorization error.
- Evidence includes EV logs or Keychain messages.
- Next steps instruct unlocking Keychain or allowing access.

## Cleanup

- Restore Keychain settings if modified.
