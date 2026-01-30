# CEP Agentic Troubleshooting Design

## Overview

This document defines the architecture for a CEP troubleshooting assistant that combines deterministic evidence gathering with probabilistic reasoning. The system is designed to feel AI-first while staying grounded in real data and safe operations.

## Goals

- Provide trustworthy fleet overviews grounded in evidence.
- Diagnose issues like "userX cannot access foo.com" without guessing.
- Separate deterministic checks from AI reasoning.
- Keep tools modular and avoid sprawl (YAGNI).

## Non-Goals

- Fully automated remediation without confirmation.
- Broad, unbounded multi-agent orchestration.

## Core Principles

- **Evidence first:** AI only reasons over structured facts, never raw APIs.
- **Structured outputs:** AI emits schemas with explicit confidence and evidence.
- **Modular tools:** A small set of composable tools power most flows.
- **Deterministic checks:** Configuration rules are validated by pure functions.

## System Architecture

### Deterministic Layer

**Responsibilities**

- Fetch configuration, policies, and logs from Google APIs.
- Derive validation results using explicit rule checks.
- Emit a single Evidence Bundle.

**Modules**

- `CepToolExecutor` for API calls.
- Validator functions for connector and DLP correctness.
- Evidence Bundle builder.

### Probabilistic Layer

**Responsibilities**

- Summarize state with human-readable rationale.
- Form hypotheses with confidence and evidence.
- Suggest safe next steps based on available data.

**Contracts**

- Structured output schemas (overview + troubleshooting).
- Evidence citations required for each hypothesis.

### Orchestration Layer

- Single agent with tool routing + evidence synthesis.
- Optional specialized sub-reasoner for complex prompts.

## Evidence Bundle (Contract)

```json
{
  "facts": {
    "events": {
      "count": 12,
      "window": { "start": "ISO", "end": "ISO" },
      "user": "user@domain.com",
      "domain": "foo.com"
    },
    "dlpRules": {
      "count": 4,
      "ruleIds": ["..."],
      "errors": []
    },
    "connectors": {
      "resolvedPolicies": 8,
      "missingSchemas": ["chrome.users.EventReportingSettings"],
      "errors": []
    }
  },
  "checks": {
    "connectorConfigured": { "status": "fail", "evidence": ["..."] },
    "eventReportingEnabled": {
      "status": "unknown",
      "evidence": ["missing schema"]
    },
    "dlpRulesPresent": { "status": "pass", "evidence": ["ruleIds"] }
  },
  "gaps": [
    { "missing": "eventReportingSettings", "why": "policyResolveFailed" }
  ],
  "errors": [{ "source": "AdminSDK", "message": "403 ... missing scope" }]
}
```

## Structured AI Outputs

### Overview Schema

```json
{
  "headline": "I just reviewed your Chrome fleet.",
  "summary": "Events: 12 in last 24h; DLP rules: 4; connectors: missing EventReporting.",
  "postureCards": [{ "label": "...", "value": "...", "note": "..." }],
  "suggestions": ["..."]
}
```

### Troubleshooting Schema

```json
{
  "hypotheses": [{ "cause": "...", "confidence": 0.72, "evidence": ["..."] }],
  "missingData": ["..."],
  "actions": [
    { "step": "...", "risk": "low|med|high", "requiresConfirmation": true }
  ]
}
```

## Tooling Plan (MVP)

### Data Tools

- `getChromeEvents` (Admin SDK Reports API)
- `listDLPRules` (Cloud Identity policies.list)
- `getChromeConnectorConfiguration` (Chrome Policy policies:resolve)
- `resolvePolicyForTarget` (Chrome Policy policies:resolve with OU or group)
- `getFleetOverview` (composes above + structured AI summary)

### Validator Functions (Deterministic)

- `validateConnectors(evidence)`
- `validateEventReporting(evidence)`
- `validateDlpRules(evidence)`
- `validateUserAccess(user, domain, evidence)`

## Example Flow: "Why userX cannot access foo.com"

1. Fetch policy resolution for user OU (Chrome Policy resolve).
2. Query Admin SDK events for userX and domain foo.com.
3. Validate connector and DLP rule scope deterministically.
4. Build Evidence Bundle.
5. AI returns hypotheses + evidence + next steps.

## Data Sources (API Reference Summary)

### Admin SDK Reports (Chrome events)

- Endpoint: `GET https://admin.googleapis.com/admin/reports/v1/activity/users/{userKey}/applications/{applicationName}`
- Scoping: `userKey` (email or ID), `orgUnitID`, `startTime`, `endTime`, `filters`

### Chrome Policy (policy resolution)

- Endpoint: `POST https://chromepolicy.googleapis.com/v1/{customer=customers/*}/policies:resolve`
- Scoping: `policyTargetKey.targetResource = orgunits/{orgunit_id}` or `groups/{group_id}`
- `policySchemaFilter` required per schema

### Cloud Identity (DLP policies)

- Endpoint: `GET https://cloudidentity.googleapis.com/v1beta1/policies`
- Scoping: `filter: customer == "customers/my_customer"`

## Guardrails

- AI must cite evidence for each hypothesis.
- If a key input is missing, AI must request it explicitly.
- High-risk actions require confirmation.

## Latency Budget

- Target: <= 90 seconds for full troubleshooting.
- Prefer parallel tool calls; cap tool fan-out.

## Open Questions

- Should we attach confidence scores to all hypotheses? (Yes)
- Should we require evidence citations for each hypothesis? (Yes)
- What user-level policy context is required for OU vs. user targeting?
