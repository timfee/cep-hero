# EC-055: Connector connectivity (network/firewall)

## Summary

Connectors cannot upload for scanning due to blocked ingestion endpoints.

## Reproduction

1. Block connector ingestion endpoint (e.g., malachiteingestion).
2. Observe CONTENT_UNSCANNED_SERVICE_UNAVAILABLE.
3. Ask how to restore connectivity.

## Conversation

User: “Connector uploads fail on our network.”

## Expected result

- Diagnosis identifies blocked connector endpoints.
- Evidence references event reason and endpoint hostnames.
- Next steps advise firewall allowlisting.

## Cleanup

- Restore firewall rules if changed.
