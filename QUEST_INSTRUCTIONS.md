# CEP-Hero Evaluation System: Quest Instructions

This document provides comprehensive guidance for understanding, running, and improving the CEP-Hero evaluation system. It is designed for tech-savvy engineers who may be new to AI evaluation frameworks.

## What Are Evals?

Evaluations (evals) are behavioral tests for AI systems. Unlike traditional unit tests that verify deterministic code paths, evals measure whether an AI agent produces appropriate responses given specific inputs. They answer the question: "Given this troubleshooting scenario, does our AI assistant provide helpful, accurate, and actionable guidance?"

Evals differ from tests in several important ways. Traditional tests have binary pass/fail outcomes based on exact matches, while evals assess quality along multiple dimensions (accuracy, completeness, relevance). Tests verify code correctness, but evals verify AI behavior. Tests are deterministic, but evals must account for natural variation in AI responses.

## Why Evals Matter for CEP-Hero

CEP-Hero helps Chrome Enterprise Premium administrators troubleshoot complex policy, connector, and fleet management issues. The AI must understand nuanced scenarios involving organizational units, DLP rules, connector configurations, and audit events. Evals ensure the system consistently provides accurate diagnoses and actionable next steps.

Without evals, we would be "flying blind" - catching issues only when users report problems. Evals make behavioral changes visible before they affect users, and their value compounds over the lifecycle of the agent.

## Architecture Overview

The eval system uses fixture injection to provide deterministic test data to the AI without calling live Google APIs. This enables reproducible testing of AI diagnostic capabilities.

### Key Components

The system consists of several interconnected parts:

**Registry** (`evals/registry.json`): The source of truth for all 85 eval cases organized into 15 failure-domain categories. Each entry defines the case ID, title, category, tags, expected response schema, fixture references, required evidence markers, and rubric criteria.

**Case Files** (`evals/cases/EC-###-*.md`): Human-readable scenario descriptions including the user prompt, expected behavior, and cleanup steps. These serve as both documentation and the source of prompts for eval runs.

**Fixtures** (`evals/fixtures/`): Deterministic data that simulates API responses. The `base/api-base.json` file provides a baseline snapshot of org units, policy schemas, and audit events. Case-specific overrides in `EC-###/overrides.json` customize the baseline for specific scenarios.

**Eval Runner** (`evals/lib/`): Standalone eval execution engine that does NOT depend on bun:test. This separation ensures evals assess AI behavior quality while unit tests (in `tests/`) verify code correctness.

**Test Helpers** (`lib/test-helpers/`): Shared utilities including `eval-server.ts` for server lifecycle management and `chat-client.ts` for HTTP client interactions.

### How Fixture Injection Works

When you run evals with `EVAL_USE_BASE=1` and `EVAL_USE_FIXTURES=1`:

1. The test file loads fixtures via `loadEvalFixtures(caseId)` which merges base data with case-specific overrides
2. Fixtures are sent to the chat API in the request body with `X-Eval-Test-Mode: 1` header
3. The API creates a `FixtureToolExecutor` that returns fixture data instead of calling Google APIs
4. The AI reasons over the fixture data and produces diagnostic output
5. The test validates the response structure, evidence markers, and rubric criteria

This approach enables fast, reproducible, quota-free testing while still exercising the full AI reasoning pipeline.

## Running Evals

### Prerequisites

Start the development server in one terminal:

```bash
bun run dev
```

### Basic Commands

Run all evals (with server management):

```bash
EVAL_USE_BASE=1 bun run evals
```

Run all evals (server already running):

```bash
EVAL_USE_BASE=1 bun run evals:fast
```

Run a specific category:

```bash
EVAL_CATEGORY=connector EVAL_USE_BASE=1 bun run evals
EVAL_CATEGORY=policy EVAL_USE_BASE=1 bun run evals
EVAL_CATEGORY=dlp EVAL_USE_BASE=1 bun run evals
```

Run specific cases by ID:

```bash
EVAL_IDS=EC-057,EC-058 EVAL_USE_BASE=1 bun run evals
```

Run cases by tag:

```bash
EVAL_TAGS=dlp EVAL_USE_BASE=1 bun run evals
```

### Environment Variables

Control eval behavior with these environment variables:

| Variable               | Purpose                                                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EVAL_USE_BASE=1`      | Load base fixtures from `evals/fixtures/base/api-base.json`                                                                                                    |
| `EVAL_USE_FIXTURES=1`  | Load case-specific overrides from `evals/fixtures/EC-###/`                                                                                                     |
| `EVAL_TEST_MODE=1`     | Return synthetic responses without calling the AI (fast mode)                                                                                                  |
| `EVAL_IDS`             | Comma-separated list of case IDs to run                                                                                                                        |
| `EVAL_CATEGORY`        | Filter by category (policy, dlp, connector, system, enrollment, security, network, devices, integration, extensions, endpoint, browser, auth, events, updates) |
| `EVAL_TAGS`            | Comma-separated list of tags to filter by                                                                                                                      |
| `EVAL_MANAGE_SERVER=0` | Skip automatic server lifecycle management                                                                                                                     |
| `EVAL_VERBOSE=1`       | Enable verbose output                                                                                                                                          |

### Recommended Workflows

For development iteration:

```bash
# Start server once
bun run dev

# Run specific case repeatedly as you iterate
EVAL_IDS=EC-057 EVAL_USE_BASE=1 bun run evals:fast
```

For comprehensive testing:

```bash
EVAL_USE_BASE=1 bun run evals:fast
```

For quota-safe CI:

```bash
EVAL_TEST_MODE=1 bun run evals
```

## Understanding Eval Results

### Report Files

Each eval run writes JSON reports to `evals/reports/`. Reports include:

- `caseId`, `title`, `category`, `tags`: Case identification
- `prompt`: The full prompt sent to the AI
- `responseText`: The AI's response
- `responseMetadata`: Structured metadata (diagnosis, evidence, hypotheses, nextSteps)
- `schemaMatched`: Whether the response contained expected schema fields
- `rubricScore`, `rubricCriteria`, `rubricMinScore`: Rubric evaluation results
- `status`: "pass" or "fail"
- `durationMs`: Response time
- `error`: Error message if the case failed

### Interpreting Failures

When an eval fails, examine the report to understand why:

**Schema mismatch**: The response lacks expected fields (diagnosis, evidence, hypotheses, next_steps). This may indicate the AI didn't understand the scenario or the prompt needs refinement.

**Missing evidence**: The response doesn't mention required evidence markers. Either the fixture data is insufficient, the prompt doesn't guide the AI to the right information, or the AI is ignoring relevant data.

**Low rubric score**: The response doesn't meet quality criteria. Review the criteria and determine if the AI needs better system instructions, more context, or different tools.

### What To Do When Results Don't Align

When an eval produces unexpected results, you have several options:

1. **Tighten the eval**: Add `required_evidence` terms in `registry.json` and run with `EVAL_STRICT_EVIDENCE=1`. If it fails, the response is out of spec.

2. **Adjust the fixture**: Add the exact data you expect the AI to reference. Keep fixtures short and focused so the model is less likely to ignore them.

3. **Adjust the prompt**: Add clarifying notes in the case file to guide the AI toward the expected response.

4. **Improve system instructions**: If the AI consistently misses certain patterns, update the system prompt in the chat API.

5. **Add or improve tools**: If the AI lacks access to necessary information, add new tools or improve existing ones.

6. **Use RAG or web search**: If the AI needs domain knowledge it doesn't have, ensure it can access the knowledge base or perform web searches.

## Adding New Evals

### When to Add an Eval

Add a new eval when you:

- Ship a new troubleshooting path
- Fix a bug that should never regress
- Encounter a customer failure mode you want to lock down
- Identify a gap in current coverage

### How to Add an Eval

1. **Create a case file** in `evals/cases/` with an EC ID following the naming convention `EC-###-descriptive-name.md`:

```markdown
# EC-086: Your scenario title

## Summary

Brief description of the troubleshooting scenario.

## Reproduction

1. Step-by-step reproduction instructions
2. What conditions trigger this scenario
3. What the user observes

## Conversation

User: "The exact prompt the user would ask"

## Expected result

- What the diagnosis should identify
- What evidence should be referenced
- What next steps should be recommended

## Cleanup

- Any cleanup steps if using live data
```

2. **Add an entry in `registry.json`**:

```json
{
  "id": "EC-086",
  "title": "Your scenario title",
  "category": "policy",
  "source_refs": ["YourSource-1"],
  "case_file": "evals/cases/EC-086-your-scenario-title.md",
  "mode": "rubric",
  "tags": ["relevant", "tags"],
  "expected_schema": ["diagnosis", "evidence", "hypotheses", "next_steps"],
  "fixtures": [],
  "required_evidence": ["key", "terms"],
  "rubric": {
    "min_score": 2,
    "criteria": ["diagnosis", "evidence", "next"]
  }
}
```

3. **Optionally create fixtures** in `evals/fixtures/EC-086/overrides.json` if the case needs specific data.

4. **Run the eval in isolation**:

```bash
EVAL_IDS=EC-086 EVAL_USE_BASE=1 bun run evals
```

## Eval Categories

Evals are organized by failure domain to make it easier to find related cases and identify coverage gaps. The 15 categories are:

- **policy** (15 cases): Policy application, precedence, inheritance, schema issues
- **dlp** (9 cases): Data Loss Prevention rules, detection, false positives
- **connector** (8 cases): Chrome connectors (bulk, web, file transfer, print)
- **system** (7 cases): API quota, rate limits, reference docs, general system issues
- **enrollment** (7 cases): Device/browser enrollment, tokens, permissions
- **security** (6 cases): Safe Browsing, access levels, encryption, CAA
- **network** (6 cases): Connectivity, proxy, firewall, SSL inspection
- **devices** (6 cases): Device management, org units, deprovisioning
- **integration** (4 cases): Citrix SPA and other third-party integrations
- **extensions** (4 cases): Extension management, force-install, permissions
- **endpoint** (4 cases): Endpoint Verification sync and key recovery
- **browser** (3 cases): Browser crashes, performance, profile issues
- **auth** (3 cases): Authentication, tokens, session revocation
- **events** (2 cases): Event reporting and telemetry
- **updates** (1 case): ChromeOS auto-update issues

## Best Practices

### Fixture Design

Keep fixtures short and focused. Long fixtures increase the chance the AI will miss important details. Include only the data necessary to trigger the expected diagnosis.

Redact sensitive information (emails, IPs, customer IDs) but preserve the structure that the AI needs to reason about.

Use the base snapshot for common data (org units, policy schemas) and case-specific overrides for scenario-specific data.

### Prompt Design

Write prompts that reflect how real administrators would ask questions. Avoid overly specific or leading prompts that make the eval trivially easy.

Include enough context for the AI to understand the scenario, but don't give away the answer.

### Evidence Markers

Choose evidence markers that are specific enough to verify the AI found the right information, but general enough to allow natural variation in phrasing.

### Rubric Criteria

Define criteria that capture the essential qualities of a good response:

- Did it identify the root cause?
- Did it reference relevant evidence?
- Did it provide actionable next steps?

## AI SDK Patterns

CEP-Hero uses the Vercel AI SDK. When improving the system, consider these patterns from the AI SDK documentation:

### Loop Control

**IMPORTANT**: CEP-Hero currently uses `stopWhen: stepCountIs(5)` in `lib/chat/chat-service.ts` (line 170). This is significantly lower than the AI SDK default of 20 steps.

This limit may need to be increased or made dynamic for complex diagnostic scenarios. The user has explicitly requested researching dynamic loop control per AI SDK best practices.

Options for improvement:

- `stepCountIs(n)`: Stop after n steps (current approach)
- `hasToolCall('toolName')`: Stop after calling a specific tool
- Custom conditions based on response content
- Dynamic limits based on query complexity

### Workflow Patterns

Consider these patterns for complex diagnostics:

- **Sequential Processing**: Steps executed in order (data collection → analysis → diagnosis)
- **Parallel Processing**: Independent data collection tasks run simultaneously
- **Routing**: Direct work based on the type of issue detected
- **Evaluation Loops**: Check results and iterate if quality is insufficient

### Avoiding Whack-a-Mole

Don't add ad-hoc system instructions to fix individual eval failures. Instead:

1. Identify patterns across multiple failures
2. Design general solutions that improve overall behavior
3. Test changes against the full eval suite
4. Document the reasoning behind system instruction changes

## Progress Tracking

Progress on eval improvements is tracked in `QUEST_TASKS.md`. Each session should:

1. Read `QUEST_TASKS.md` to understand current state
2. Pick up the next pending task
3. Complete the task and update the tracking file
4. Document any discoveries or decisions

## References

- [Anthropic: Demystifying Evals for AI Agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- [AI SDK: Building Agents](https://ai-sdk.dev/docs/agents/building-agents)
- [AI SDK: Workflow Patterns](https://ai-sdk.dev/docs/agents/workflows)
- [AI SDK: Loop Control](https://ai-sdk.dev/docs/agents/loop-control)
