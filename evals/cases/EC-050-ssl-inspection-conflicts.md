# EC-050: SSL inspection conflicts

## Summary

SSL inspection breaks certificate pinning for CEP services, causing failures.

## Reproduction

1. Enable SSL inspection on network appliances.
2. Attempt connector or endpoint verification calls.
3. Observe CERT_AUTHORITY_INVALID or SSL errors.

## Conversation

User: “Why do CEP connectors fail only on our network?”

## Expected result

- Diagnosis points to SSL inspection or MITM conflicts.
- Evidence includes SSL_CERTIFICATE_ERROR logs.
- Next steps advise bypassing Google domains from inspection.

## Cleanup

- None.
