# EC-001: Network connectivity during enrollment or first-time setup

## Summary

Enrollment fails because the device cannot reach Wi-Fi or cellular networks
during initial setup.

## Reproduction

1. Attempt enrollment on a device with weak or misconfigured Wi-Fi.
2. Collect `net.log` and `eventlog.txt` from device debug logs.
3. Ask why enrollment cannot proceed.

## Conversation

User: “Enrollment fails during setup. The device can’t connect to Wi‑Fi.”

## Expected result

- Diagnosis identifies network connectivity as the blocking factor.
- Evidence references `net.log`/`eventlog.txt` or device network status.
- Next steps recommend router reset, supported protocols, and alternate network.

## Cleanup

- None.
