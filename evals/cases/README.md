# CEP eval case index

This directory contains one Markdown file per eval case (EC-001 to EC-085). Each file uses the same sections (Summary, Reproduction, Conversation, Expected result, Cleanup) so the tests and documentation stay aligned.

Cases are organized by **failure domain** (15 categories) rather than by source document. The registry (`evals/registry.json`) is the source of truth for case metadata.

## Running evals

```bash
# Run all evals
EVAL_FIXTURES=1 bun run evals

# Run by category
EVAL_CATEGORY=connector EVAL_FIXTURES=1 bun run evals

# Run specific case
EVAL_IDS=EC-057 EVAL_FIXTURES=1 bun run evals
```

## Categories

Cases are organized into 15 failure-domain categories:

| Category    | Description                                |
| ----------- | ------------------------------------------ |
| enrollment  | Device/browser enrollment and registration |
| network     | Network connectivity and proxy issues      |
| policy      | Policy application and precedence          |
| connector   | Chrome connector configuration             |
| dlp         | Data Loss Prevention rules and triggers    |
| extensions  | Extension installation and management      |
| endpoint    | Endpoint Verification and device posture   |
| devices     | Device management and sync                 |
| browser     | Browser performance and crashes            |
| security    | Security settings and Safe Browsing        |
| updates     | ChromeOS and browser updates               |
| integration | Third-party integrations (Citrix, etc.)    |
| auth        | Authentication and token issues            |
| events      | Event reporting and audit logs             |
| system      | API quotas and system-level issues         |

## Fixtures

Fixtures exist only for EC-001/002/003 (net logs and update_engine samples). Add concise fixtures under `evals/fixtures/EC-###/` when you tighten a case.

The base fixture (`evals/fixtures/base/api-base.json`) provides a baseline snapshot of org units, policy schemas, and audit events that all evals can use
