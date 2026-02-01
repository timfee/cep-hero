# EC-051: Connector handshake & service availability

## Summary
Connector scanning fails because the service is unavailable or rate limited.

## Reproduction
1. Trigger CONTENT_UNSCANNED_SERVICE_UNAVAILABLE or TOO_MANY_REQUESTS events.
2. Inspect audit logs for connector errors.
3. Ask why connectors are failing.

## Conversation
User: “Connector scanning fails with service unavailable errors.”

## Expected result
- Diagnosis references connector service availability.
- Evidence includes event reason codes from logs.
- Next steps advise checking service status and network allowlists.

## Cleanup
- None.
