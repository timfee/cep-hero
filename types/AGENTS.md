# Types Directory

See the root [AGENTS.md](../AGENTS.md) for project-wide coding standards.

## Scope

Shared TypeScript type definitions used across the application.

## Files

- **`chat.ts`** - Chat-related types including:
  - `ToolInvocationPart` - Tool execution message parts
  - `ChromeEventsOutput` - Chrome events response shape
  - `DlpRulesOutput` - DLP rules response shape
  - `ConnectorConfigOutput` - Connector configuration response
  - `PolicyChangeConfirmationOutput` - UI confirmation structure for draft-and-apply
  - `Hypothesis` - Diagnostic hypothesis with confidence scores
  - `EvidencePayload` - Evidence collection structure
  - `DiagnosisPayload` - Complete diagnostic result

## Guidelines

- Keep types minimal, descriptive, and stable
- Document exported types with TSDoc
- Use discriminated unions over type assertions
- Prefer `lib/mcp/types.ts` for MCP-related types (ToolExecutor interface, API result types)
- Prefer `lib/overview.ts` for dashboard-related types (OverviewData, OverviewCard, Suggestion)
