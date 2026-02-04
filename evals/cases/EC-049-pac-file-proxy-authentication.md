# EC-049: PAC file and proxy authentication

## Summary

PAC file or proxy authentication prevents CEP traffic from reaching Google
services.

## Reproduction

1. Configure ProxyMode and ProxyPacUrl.
2. Use a PAC file requiring authentication.
3. Observe network errors in chrome_audit logs.

## Conversation

User: “Why can’t the browser reach the CEP proxy?”

## Expected result

- Diagnosis references PAC file accessibility and proxy auth issues.
- Evidence includes network error events.
- Next steps advise hosting PAC without auth or adjusting proxy settings.

## Cleanup

- None.
