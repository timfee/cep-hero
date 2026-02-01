# EC-012: Endpoint Verification service worker registration bug

## Summary

EV fails to load due to a service worker registration bug.

## Reproduction

1. Reproduce SW registration failure (Status code 2).
2. Capture DevTools console errors.
3. Ask why EV fails to load.

## Conversation

User: “Endpoint Verification fails with service worker registration error.”

## Expected result

- Diagnosis cites known EV SW bug.
- Evidence references console error or issue tracker ID.
- Next steps recommend updating/reinstalling EV and Chrome.

## Cleanup

- None.
