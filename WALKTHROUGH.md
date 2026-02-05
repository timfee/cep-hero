# CEP Hero Architecture Walkthrough

CEP Hero is an AI-powered troubleshooting assistant for Chrome Enterprise Premium. This document explains how the system works, why it's designed the way it is, and how the pieces fit together.

## Table of Contents

1. [What Problem Does This Solve?](#what-problem-does-this-solve)
2. [The Core Architecture](#the-core-architecture)
3. [Authentication: Getting Access to Google APIs](#authentication-getting-access-to-google-apis)
4. [The Tool System: How the AI Gathers Data](#the-tool-system-how-the-ai-gathers-data)
5. [The Chat System: Orchestrating AI Conversations](#the-chat-system-orchestrating-ai-conversations)
6. [The Dashboard: Evidence-First Summarization](#the-dashboard-evidence-first-summarization)
7. [Policy Changes: The Draft-and-Apply Pattern](#policy-changes-the-draft-and-apply-pattern)
8. [Testing: Fixtures and Determinism](#testing-fixtures-and-determinism)
9. [Evaluation: Measuring AI Quality](#evaluation-measuring-ai-quality)
10. [Project Structure Reference](#project-structure-reference)

## What Problem Does This Solve?

Chrome Enterprise Premium administrators face a difficult challenge. When something goes wrong—browsers not enrolling, DLP rules blocking legitimate work, policies not applying correctly—the data needed to diagnose the problem exists across multiple Google APIs. Chrome events live in the Admin SDK. Policy configurations live in the Chrome Policy API. DLP rules live in Cloud Identity. Organizational unit hierarchies live in the Directory API.

An experienced administrator might spend 30 minutes clicking through the Admin Console, cross-referencing timestamps, checking policy inheritance, and piecing together what happened. CEP Hero automates this process. It connects to the same APIs, gathers the relevant data, and uses an LLM to correlate the evidence and explain what's wrong.

The key insight is that the AI doesn't guess. Every diagnosis must be grounded in actual data from the APIs. If the AI says "your enrollment is failing because of a network error," it's because it found `ERR_NAME_NOT_RESOLVED` in the Chrome events. This evidence-first approach makes the system trustworthy.

## The Core Architecture

The application follows a three-tier architecture, but with an interesting twist: the AI acts as an orchestration layer that decides what data to fetch and how to interpret it.

**Tier 1: The Frontend** renders a dashboard and chat interface. The dashboard shows a high-level overview of the Chrome Enterprise deployment. The chat lets administrators ask questions and receive AI-powered diagnoses.

**Tier 2: The API Layer** handles authentication, routes requests, and manages the conversation state. When a user sends a message, this layer validates their session, retrieves their Google OAuth token, and passes the conversation to the AI.

**Tier 3: The Tool Executors** actually call the Google APIs. This is where Chrome events get fetched, DLP rules get listed, and policies get resolved. The executors are abstracted behind an interface, which becomes important for testing.

The AI sits between tiers 2 and 3. It receives the user's question, decides which tools to call, interprets the results, and formulates a response. The Vercel AI SDK handles this orchestration automatically—when the AI decides to call a tool, the SDK pauses the response, executes the tool, feeds the result back to the AI, and continues.

## Authentication: Getting Access to Google APIs

### Why OAuth Matters

CEP Hero doesn't store Google credentials. Instead, it uses OAuth 2.0 to get temporary access tokens that let it call APIs on behalf of the signed-in administrator. This is both more secure (no passwords stored) and more appropriate (the app acts with the user's permissions, not its own).

When an administrator signs in, Google shows a consent screen listing the permissions the app is requesting. These permissions are called "scopes," and each one unlocks specific API capabilities:

- `chrome.management.reports.readonly` lets the app read Chrome audit events—the log of everything that happens in managed browsers
- `chrome.management.policy` lets the app read and write Chrome policies
- `cloud-identity.policies` lets the app manage DLP rules
- `admin.directory.orgunit` lets the app see the organizational unit hierarchy

The app requests offline access, which means Google provides a refresh token in addition to the access token. Access tokens expire after an hour, but the refresh token lets the app get new access tokens without requiring the user to sign in again. This is important because diagnostic sessions can be long.

### How Sessions Work

Better Auth, the authentication library, manages the session lifecycle. When a user completes the OAuth flow, Better Auth stores the tokens in a session cookie. The cookie is HTTP-only (JavaScript can't read it) and signed (tampering is detected).

When an API route needs to call Google APIs, it retrieves the access token from the session:

```typescript
const session = await auth.api.getSession({ headers: req.headers });
const { accessToken } = await auth.api.getAccessToken({
  body: { providerId: "google" },
  headers: req.headers,
});
```

If the access token has expired, Better Auth automatically uses the refresh token to get a new one. This happens transparently—the API route just gets a valid token.

### The Scopes in Detail

The choice of scopes represents a balance between functionality and least-privilege. The app requests only what it needs:

**Read-only scopes** for gathering diagnostic data: Chrome events, audit logs, directory information. The app needs to see what's happening but doesn't need to modify these resources.

**Read-write scopes** for Chrome policies and DLP rules. The app can propose and apply configuration changes, but only with explicit user confirmation (more on this later).

If an administrator's Google account doesn't have permission to perform an action (for example, they're not a super admin), the API call will fail even though the app requested the scope. OAuth scopes define what the app _can ask for_, not what the user _can do_.

## The Tool System: How the AI Gathers Data

### The ToolExecutor Interface

The tool system is built around a TypeScript interface called `ToolExecutor`. This interface defines every operation the AI can perform:

```typescript
export interface ToolExecutor {
  getChromeEvents(args): Promise<ChromeEventsResult>;
  listDLPRules(args): Promise<ListDLPRulesResult>;
  listOrgUnits(): Promise<ListOrgUnitsResult>;
  getChromeConnectorConfiguration(): Promise<ConnectorConfigResult>;
  draftPolicyChange(args): Promise<DraftPolicyChangeResult>;
  applyPolicyChange(args): Promise<ApplyPolicyChangeResult>;
  // ... more methods
}
```

The interface is implemented twice. `CepToolExecutor` is the production implementation that calls real Google APIs. `FixtureToolExecutor` is the test implementation that returns predetermined data. The chat service doesn't know which implementation it's using—it just calls the interface methods. This pattern, called dependency injection, makes the system testable without mocking.

### How Tools Map to Google APIs

Each tool method corresponds to one or more Google API calls. Let's trace through `getChromeEvents` to see how this works.

When the AI calls `getChromeEvents({ maxResults: 50 })`, the executor calls the Admin SDK's Reports API:

```typescript
const admin = google.admin({ version: "reports_v1", auth: this.auth });
const response = await admin.activities.list({
  userKey: "all",
  applicationName: "chrome",
  maxResults: args.maxResults,
  startTime: args.startTime,
  endTime: args.endTime,
});
```

The raw API response contains nested objects with Google's internal field names. The executor transforms this into a cleaner structure that's easier for the AI to understand:

```typescript
return {
  events:
    response.data.items?.map((item) => ({
      time: item.id?.time,
      actor: item.actor?.email,
      eventType: item.events?.[0]?.type,
      eventName: item.events?.[0]?.name,
      parameters: item.events?.[0]?.parameters,
    })) ?? [],
  nextPageToken: response.data.nextPageToken,
};
```

This transformation is important. The AI works better with clean, consistent data structures than with deeply nested API responses.

### Input Validation with Zod

Every tool has a schema that defines its valid inputs. These schemas use Zod, a TypeScript-first validation library:

```typescript
export const GetChromeEventsSchema = z.object({
  maxResults: z.number().min(1).max(1000).optional().default(50),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  pageToken: z.string().optional(),
});
```

The schema serves three purposes. First, it validates inputs at runtime—if the AI tries to pass invalid arguments, the call fails with a clear error. Second, it generates TypeScript types automatically via `z.infer<typeof GetChromeEventsSchema>`. Third, it tells the AI what parameters each tool accepts, because the AI SDK converts Zod schemas into the JSON Schema format that LLMs understand.

### The Connector Configuration Tool

Some tools are more complex than a single API call. `getChromeConnectorConfiguration` demonstrates this. It needs to:

1. Determine which organizational units to check
2. Call the Chrome Policy API's resolve endpoint for each policy schema
3. Aggregate the results across multiple schemas

The Chrome connector has several policy schemas that control different features: `SafeBrowsingExt` for malware protection, `EventReportingSettings` for telemetry, `CookieEncryption` for security, and `IncognitoModeAvailability` for browser restrictions. The tool resolves all of these and returns a unified view:

```typescript
const schemas = [
  "chrome.users.SafeBrowsingExt",
  "chrome.users.EventReportingSettings",
  "chrome.users.CookieEncryption",
  "chrome.users.IncognitoModeAvailability",
];

const policies = await Promise.all(
  schemas.map((schema) => resolvePolicy(auth, schema, targetOrgUnit))
);
```

By parallelizing the API calls, the tool returns results faster than if it called each one sequentially.

## The Chat System: Orchestrating AI Conversations

### The Three Layers

The chat system has three distinct layers, each with a specific responsibility.

**The API Route** (`app/api/chat/route.ts`) handles HTTP concerns. It validates the session, retrieves the access token, parses the request body, and returns a streaming response. It's the entry point for all chat requests.

**The Chat Service** (`lib/chat/chat-service.ts`) orchestrates the AI conversation. It defines the system prompt, registers the available tools, and configures how the AI should behave. This is where the "personality" of CEP Hero is defined.

**The React Context** (`components/chat/chat-context.tsx`) manages client-side state. It tracks the conversation history, handles message sending, and provides chat state to React components throughout the app.

### The System Prompt

The system prompt is a detailed instruction set that shapes how the AI behaves. It's not just "you are a helpful assistant"—it's a comprehensive guide covering capabilities, workflows, and response formatting.

The prompt establishes what the AI can and cannot do:

```
You CAN:
- Fetch and analyze Chrome events, DLP rules, and connector configurations
- Diagnose policy scoping issues and configuration problems
- Draft policy change proposals using the draftPolicyChange tool
- Apply policy changes after user confirmation

You CANNOT:
- Execute changes without explicit user confirmation
```

It defines the policy change workflow in detail, explaining the draft-and-apply pattern and when to use each tool. It specifies how to format org unit references (friendly paths like "/Engineering" instead of raw IDs like "orgunits/03ph8a2z"). It requires the AI to cite specific evidence from tool results.

The prompt is long—several hundred lines—because the AI needs clear, specific guidance to behave consistently. Vague instructions lead to inconsistent behavior.

### Tool Execution Flow

When the AI decides to call a tool, the Vercel AI SDK handles the execution automatically. Here's what happens:

1. The AI generates a response that includes a tool call: "I'll check the Chrome events" followed by `getChromeEvents({ maxResults: 50 })`

2. The SDK intercepts this, pauses the response stream, and calls the tool's `execute` function

3. The execute function runs the actual API call via the executor

4. The SDK feeds the result back to the AI as a "tool result" message

5. The AI continues generating, now with access to the data

This can happen multiple times in a single response. The AI might call `getChromeEvents`, see something suspicious, call `getChromeConnectorConfiguration` to investigate, and then synthesize both results into a diagnosis.

### Response Streaming

The chat uses streaming responses, which means the user sees text appear progressively rather than waiting for the complete response. This is important for UX—a diagnosis might take 10 seconds to generate, and streaming makes the wait feel shorter.

The streaming protocol includes both text chunks and structured data for tool calls and results. The React components parse this stream and render tool outputs as rich UI elements (tables, cards, etc.) rather than raw JSON.

### Conversation Guards

The chat service includes "guards" that ensure response quality. These are implemented using the AI SDK's `prepareStep` callback, which runs between each step of the conversation.

For example, the short response guard detects when the AI gives an incomplete answer:

```typescript
prepareStep: ({ steps }) => {
  const lastStep = steps.at(-1);
  if (lastStep?.text.length < 200 && lastStep?.toolResults.length > 0) {
    return {
      system: `Your response was too brief. Provide a complete diagnosis with:
        1. What the evidence shows
        2. What this means
        3. Recommended next steps`,
    };
  }
  return {};
};
```

If the AI tries to say "I'll check the events" and stop, the guard injects additional instructions requiring a complete response.

## The Dashboard: Evidence-First Summarization

### The Two-Layer Pattern

The dashboard demonstrates an important architectural pattern: separating evidence extraction from AI interpretation. This pattern appears throughout the codebase, but it's most visible here.

**Layer 1: Deterministic Extraction**

The first layer extracts facts from raw API data. This is pure computation with no AI involvement:

```typescript
function extractFleetOverviewFacts(data: RawApiData): FleetOverviewFacts {
  return {
    eventCount: data.events?.length ?? 0,
    blockedEventCount:
      data.events?.filter((e) => isBlockedEvent(e)).length ?? 0,
    dlpRuleCount: data.dlpRules?.length ?? 0,
    hasConnectorPolicies: (data.connectorPolicies?.length ?? 0) > 0,
    oldestEventAge: calculateEventAge(data.events),
  };
}
```

Given the same input, this function always returns the same output. It's easy to test, easy to debug, and completely predictable.

**Layer 2: AI Summarization**

The second layer uses the AI to generate human-readable summaries from the extracted facts:

```typescript
const summary = await generateObject({
  model: google("gemini-2.0-flash"),
  schema: FleetOverviewResponseSchema,
  prompt: `Given these facts about a Chrome Enterprise deployment:
    - ${facts.eventCount} Chrome events in the observation window
    - ${facts.blockedEventCount} events were security blocks
    - ${facts.dlpRuleCount} DLP rules are configured

    Generate a dashboard summary with status cards and recommendations.`,
});
```

The AI receives clean, structured facts rather than raw API responses. This makes the prompts more predictable and the outputs more consistent.

### Why This Pattern Matters

Separating extraction from interpretation has several benefits.

**Testability**: The extraction function can be unit tested with known inputs and expected outputs. If a test fails, you know whether the problem is in extraction logic or AI interpretation.

**Debuggability**: When something goes wrong, you can inspect the extracted facts to see what the AI received. This is much easier than debugging prompts with complex nested API responses.

**Token Efficiency**: The AI receives only the relevant facts, not megabytes of raw API data. This reduces costs and improves response times.

**Consistency**: The same facts always produce similar summaries. The AI isn't distracted by irrelevant fields or formatting differences in API responses.

### Structured Output

The dashboard summary uses structured output via Zod schemas. Instead of asking the AI to generate freeform text, we define exactly what shape the response should have:

```typescript
const FleetOverviewResponseSchema = z.object({
  headline: z.string().describe("Welcoming headline, no sensitive data"),
  summary: z.string().describe("2-3 sentence overview"),
  postureCards: z.array(PostureCardSchema).min(3).max(5),
  suggestions: z.array(SuggestionSchema).min(2).max(4),
});
```

The AI SDK validates the output against this schema and retries if the AI produces invalid JSON. This guarantees that the dashboard receives data in the expected format.

## Policy Changes: The Draft-and-Apply Pattern

### Why Two Steps?

Policy changes are dangerous. A misconfigured Chrome policy can lock users out of their browsers, disable security features, or break critical workflows. The draft-and-apply pattern ensures administrators know exactly what will change before it happens.

The pattern works like this:

1. **Draft**: The AI proposes a change but doesn't apply it. The proposal includes what will change, where it will apply, and why.

2. **Review**: The UI renders a confirmation card showing the proposed change. The administrator can see the exact policy values.

3. **Apply**: Only when the administrator explicitly confirms does the change actually happen.

### The Draft Response

When the AI calls `draftPolicyChange`, it receives a response designed for both the AI and the UI:

```typescript
{
  ui: {
    type: "confirmation",
    title: "Enable Cookie Encryption",
    description: "Encrypts cookies to prevent session hijacking",
    targetDisplay: "/Engineering",
  },
  applyParams: {
    policySchemaId: "chrome.users.CookieEncryption",
    targetResource: "orgunits/03ph8a2z23yjui6",
    value: { cookieEncryptionEnabled: true },
  },
  status: "pending_confirmation",
}
```

The `ui` object contains human-readable information for the confirmation card. The `applyParams` object contains the exact parameters needed to apply the change later. The AI stores these parameters and uses them verbatim when the user confirms.

### Confirmation Detection

The chat console detects confirmation patterns in user messages:

```typescript
const CONFIRM_PATTERN = /^confirm\b/i;
const CANCEL_PATTERN = /^(cancel|no|nevermind)\b/i;
```

When the user says "Confirm," the message goes to the AI, which recognizes this as approval to proceed. The AI then calls `applyPolicyChange` with the exact parameters from the draft—no modifications, no reinterpretation.

### Why This Works

The pattern prevents several failure modes:

**Accidental changes**: Users must explicitly type "Confirm." There's no button that might be clicked accidentally.

**Parameter drift**: The AI uses the stored `applyParams` exactly as provided. It can't "improve" or modify the change between draft and apply.

**Misunderstanding**: The confirmation card shows exactly what will change, including the target org unit and policy values. Users can verify before proceeding.

**Audit trail**: The conversation history shows the draft, the confirmation, and the result. This creates a clear record of what changed and why.

## Testing: Fixtures and Determinism

### The Testing Problem

Testing an AI application that calls external APIs is difficult. Real API calls are slow, require authentication, and return different data each time. The AI itself is non-deterministic—the same prompt might produce different outputs.

Fixtures solve the API problem. By injecting predetermined responses instead of calling real APIs, tests become fast, reproducible, and independent of network state.

### The Fixture Executor

`FixtureToolExecutor` implements the same `ToolExecutor` interface as the production executor, but returns fixture data instead of calling APIs:

```typescript
export class FixtureToolExecutor implements ToolExecutor {
  constructor(private fixtures: FixtureData) {}

  async getChromeEvents(args) {
    return {
      events: this.fixtures.auditEvents?.items ?? [],
      nextPageToken: null,
    };
  }
}
```

Because both executors implement the same interface, the chat service works identically with either one. The service doesn't know or care whether it's talking to Google's servers or a fixture file.

### Fixture Structure

Fixtures mirror the shape of real API responses:

```typescript
interface FixtureData {
  orgUnits?: OrgUnit[];
  auditEvents?: { items?: Activity[]; nextPageToken?: string };
  dlpRules?: DLPRule[];
  connectorPolicies?: ResolvedPolicy[];
  errors?: {
    chromeEvents?: string;
    dlpRules?: string;
  };
}
```

The `errors` field is interesting—it lets tests simulate API failures. A fixture with `errors.chromeEvents: "PERMISSION_DENIED"` tests how the system handles authorization errors.

### Fixture Injection

The chat API route checks for a special header to determine which executor to use:

```typescript
const isTestMode = req.headers.get("x-eval-test-mode") === "1";
const fixtures = extractFixtureData(body);

const executor =
  isTestMode && fixtures
    ? new FixtureToolExecutor(fixtures)
    : new CepToolExecutor(accessToken);
```

In demo mode, the chat context automatically injects fixtures with every message, allowing the app to function without real Google credentials.

## Evaluation: Measuring AI Quality

### What Evals Measure

Evals test whether the AI gives correct, complete, and well-grounded answers. Each eval case defines:

- A user prompt (what the administrator asks)
- Fixtures (what the tools return)
- Assertions (what the response must contain)

For example, an eval for network enrollment issues might require the AI to:

- Call `getChromeEvents` (the relevant tool)
- Mention `ERR_NAME_NOT_RESOLVED` (the actual error code)
- Include a diagnosis, evidence, and next steps (the expected structure)

### The Eval Registry

Cases are defined in `evals/registry.json`:

```json
{
  "id": "EC-001",
  "title": "Network connectivity during enrollment",
  "category": "enrollment",
  "expected_schema": ["diagnosis", "evidence", "next_steps"],
  "required_evidence": ["ERR_NAME_NOT_RESOLVED", "network"],
  "required_tool_calls": ["getChromeEvents"]
}
```

The `required_evidence` field lists keywords that must appear in the response. The `required_tool_calls` field specifies which tools the AI should invoke. The `expected_schema` field checks for structural elements.

### Running Evals

The eval runner executes cases in parallel, streaming each conversation through the same chat endpoint used in production:

```bash
EVAL_FIXTURES=1 bun run evals
```

Each case gets its own fixtures, isolated from other cases. The runner captures the AI's response and checks it against the assertions.

### The LLM Judge

Some assertions are difficult to check programmatically. Did the AI adequately explain the issue? Is the evidence citation sufficient? The LLM judge handles these subjective evaluations:

```typescript
const judgeResult = await generateObject({
  model: google("gemini-2.5-pro"),
  schema: JudgeResponseSchema,
  prompt: `Evaluate this diagnostic response:

    Response: "${response}"
    Required evidence: ${requiredEvidence.join(", ")}

    Did the response adequately cite the required evidence?`,
});
```

The judge uses a more capable model (Gemini 2.5 Pro) to evaluate responses from the faster model (Gemini 2.0 Flash). This catches cases where the AI uses different wording than expected but still provides correct information.

### HTML Reports

Eval runs generate HTML reports with detailed results for each case. The reports show:

- Overall pass rate and category breakdowns
- For each case: the prompt, the response, which assertions passed or failed
- Expandable details for debugging failures

Reports are committed to the repository so you can track eval performance over time.

## Project Structure Reference

```
cep-hero/
├── app/                          # Next.js pages and API routes
│   ├── api/
│   │   ├── auth/[...all]/       # OAuth endpoints via Better Auth
│   │   ├── chat/                # AI chat streaming endpoint
│   │   └── overview/            # Dashboard data endpoint
│   ├── (auth)/sign-in/          # Sign-in page
│   └── page.tsx                 # Home page (redirects if not authenticated)
│
├── components/
│   ├── chat/                    # Chat console and context provider
│   ├── cep/                     # Dashboard and app shell
│   ├── ai-elements/             # Tool output renderers (tables, cards, etc.)
│   └── ui/                      # Shared primitives (buttons, inputs, etc.)
│
├── lib/
│   ├── auth.ts                  # Better Auth configuration
│   ├── auth/                    # Shared auth utilities
│   ├── chat/                    # Chat service and AI orchestration
│   └── mcp/                     # Tool system
│       ├── executor/            # Production executor (Google API calls)
│       ├── fleet-overview/      # Dashboard extraction and summarization
│       ├── schemas.ts           # Zod schemas for tool inputs
│       ├── types.ts             # ToolExecutor interface
│       └── fixture-executor.ts  # Test executor
│
├── evals/
│   ├── cases/                   # Test scenarios (markdown files)
│   ├── fixtures/                # Test data overrides
│   ├── lib/                     # Runner, assertions, reporting
│   ├── registry.json            # Case definitions
│   └── run.ts                   # CLI entry point
│
└── tests/                       # Unit and integration tests
```

### Key Files to Start With

If you're new to the codebase, start with these files:

1. **`lib/mcp/types.ts`** — The `ToolExecutor` interface defines every operation the AI can perform. This is the contract between the chat service and the data layer.

2. **`lib/chat/chat-service.ts`** — The chat service configures the AI and registers tools. The system prompt here shapes the AI's behavior.

3. **`lib/mcp/executor/index.ts`** — The production executor implements the interface with real Google API calls. Trace through one method to see how API responses are transformed.

4. **`app/api/chat/route.ts`** — The chat endpoint ties everything together: authentication, executor selection, and response streaming.

5. **`evals/lib/runner.ts`** — The eval runner shows how cases are executed and assertions are checked. This is useful for understanding what "correct behavior" means.
