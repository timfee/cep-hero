# EC-034: Password-protected files blocked

## Summary

Encrypted archives are blocked because they are unscannable per policy.

## Reproduction

1. Enable blocking of password-protected files.
2. Attempt to transfer an encrypted archive.
3. Observe CONTENT_UNSCANNED_FILE_PASSWORD_PROTECTED.

## Conversation

User: “Why was my encrypted ZIP blocked?”

## Expected result

- Diagnosis cites policy blocking unscannable encrypted files.
- Evidence includes event reason and policy flag.
- Next steps advise decrypting or adjusting policy.

## Cleanup

- None.
