# EC-002: Enrollment error codes (401/402/403/404/405/409, -105/-107/-113)

## Summary
Enrollment fails with specific server or network error codes that indicate
license, auth, or connectivity problems.

## Reproduction
1. Trigger enrollment errors (e.g., 402 for missing license, -105 DNS).
2. Capture device management logs or `update_engine.log`.
3. Ask how to interpret the error codes.

## Conversation
User: “Enrollment shows error 402 and sometimes -105. What does that mean?”

## Expected result
- Diagnosis maps error codes to root causes (license, auth, proxy, DNS).
- Evidence references error codes from logs.
- Next steps explain license assignment or network/proxy fixes.

## Cleanup
- None.
