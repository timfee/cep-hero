# EC-010: Endpoint Verification sync failure (Windows DPAPI)

## Summary
Endpoint Verification fails to sync due to Windows DPAPI decryption errors.

## Reproduction
1. Trigger DPAPI error (e.g., S4U task).
2. Check registry keys and scheduled tasks.
3. Ask why sync fails on Windows.

## Conversation
User: “Endpoint Verification can’t sync on Windows with DPAPI errors.”

## Expected result
- Diagnosis references DPAPI and S4U tasks.
- Evidence includes registry key or task config details.
- Next steps advise updating tasks and resetting Safe Storage.

## Cleanup
- Restore task settings if modified.
