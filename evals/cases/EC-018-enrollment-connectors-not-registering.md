# EC-018: CEP enrollment/connectors not registering

## Summary

Browsers fail to register with CEP due to missing license or token application.

## Reproduction

1. Use a browser without CEP license or enrollment token.
2. Attempt enrollment and check BrowserManagement.browsers.
3. Ask why connectors are not registering.

## Conversation

User: “Browsers aren’t showing up as managed in CEP.”

## Expected result

- Diagnosis identifies missing license or token application.
- Evidence references enrollment status or missing browser records.
- Next steps instruct applying token and confirming license.

## Cleanup

- None.
