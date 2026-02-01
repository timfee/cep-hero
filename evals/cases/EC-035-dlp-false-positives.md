# EC-035: DLP false positives and snippet analysis

## Summary

DLP rules match benign content, triggering false positives.

## Reproduction

1. Enable a DLP detector (e.g., credit card).
2. Transfer content with similar patterns (e.g., SKUs).
3. Review DLP alert snippets.

## Conversation

User: “This was a product SKU list. Why did DLP block it?”

## Expected result

- Diagnosis references detector match and snippet data.
- Evidence cites predefined_detector and match info.
- Next steps advise tuning thresholds or exclusions.

## Cleanup

- None.
