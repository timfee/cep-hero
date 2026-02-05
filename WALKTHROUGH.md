# CEP Hero Architecture Walkthrough

CEP Hero is an AI-powered troubleshooting assistant for Chrome Enterprise Premium. It combines real-time data from Google Workspace APIs with an LLM to diagnose issues and guide administrators through solutions.

This document explains how everything fits together, from authentication to AI reasoning to policy changes.

---

## Table of Contents

1. [The Big Picture](#the-big-picture)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Authentication Flow](#authentication-flow)
5. [The MCP Tool System](#the-mcp-tool-system)
6. [How the Chat Works](#how-the-chat-works)
7. [The Fleet Overview Dashboard](#the-fleet-overview-dashboard)
8. [The Draft-and-Apply Pattern](#the-draft-and-apply-pattern)
9. [Testing with Fixtures](#testing-with-fixtures)
10. [The Evaluation Framework](#the-evaluation-framework)
11. [Data Flow: End-to-End Example](#data-flow-end-to-end-example)
12. [Key Architectural Decisions](#key-architectural-decisions)

---

## The Big Picture

CEP Hero solves a specific problem: Chrome Enterprise Premium administrators need to troubleshoot complex issues across browsers, devices, policies, and security rules. The data exists in various Google APIs, but correlating it and understanding what's wrong requires expertise.

The application:

1. **Authenticates** the administrator via Google OAuth with Chrome Enterprise scopes
2. **Gathers evidence** from multiple Google APIs (Chrome events, DLP rules, policies, org units)
3. **Reasons** over that evidence using an LLM (Gemini 2.0 Flash)
4. **Proposes actions** with a confirmation workflow before making changes
5. **Applies changes** to Chrome policies when the administrator confirms

The AI never guesses. Every recommendation is grounded in real data from the APIs.

---

## Technology Stack

| Layer        | Technology                               | Purpose                                              |
| ------------ | ---------------------------------------- | ---------------------------------------------------- |
| Framework    | Next.js 16 (App Router)                  | Server-side rendering, API routes, React integration |
| Language     | TypeScript 5.9                           | Type safety across the entire codebase               |
| AI/LLM       | Vercel AI SDK + Google Gemini            | Streaming chat, tool calling, structured output      |
| Auth         | Better Auth                              | OAuth 2.0 with Google, session management            |
| Google APIs  | Admin SDK, Chrome Policy, Cloud Identity | Events, policies, DLP rules, org units               |
| Search       | Upstash Vector                           | Semantic search over documentation and policies      |
| UI           | React 19, Radix UI, Tailwind CSS         | Components, accessibility, styling                   |
| Animation    | Framer Motion                            | Smooth transitions in the dashboard                  |
| Testing      | Bun test runner, happy-dom               | Unit tests, React component tests                    |
| Code Quality | Ultracite (Oxlint + Oxfmt)               | Linting and formatting                               |

---

## Project Structure

```
cep-hero/
├── app/                    # Next.js App Router
│   ├── api/               # Backend API routes
│   │   ├── auth/          # OAuth endpoints (Better Auth)
│   │   ├── chat/          # AI chat streaming endpoint
│   │   └── overview/      # Fleet dashboard data
│   ├── (auth)/            # Auth-related pages (sign-in)
│   └── page.tsx           # Home page (redirects if unauthenticated)
│
├── components/            # React components
│   ├── chat/              # Chat console and context
│   ├── cep/               # Dashboard and app shell
│   ├── ai-elements/       # Tool output renderers
│   ├── fixtures/          # Demo mode UI
│   └── ui/                # Shared UI primitives (Radix-based)
│
├── lib/                   # Core business logic
│   ├── auth.ts            # Better Auth configuration
│   ├── auth/              # Shared auth utilities
│   ├── chat/              # AI chat service
│   ├── mcp/               # Tool system (executors, schemas, types)
│   │   ├── executor/      # Google API implementations
│   │   ├── fleet-overview/# Dashboard data extraction
│   │   └── types.ts       # ToolExecutor interface
│   └── upstash/           # Vector search integration
│
├── evals/                 # Evaluation framework
│   ├── cases/             # Test scenarios (markdown)
│   ├── fixtures/          # Test data overrides
│   ├── lib/               # Eval runner, assertions, reporting
│   └── registry.json      # Test case definitions
│
└── tests/                 # Unit and integration tests
```

### What's an "App Router"?

Next.js uses file-based routing. Every folder under `app/` becomes a URL path:

- `app/page.tsx` → `/`
- `app/sign-in/page.tsx` → `/sign-in`
- `app/api/chat/route.ts` → `/api/chat`

Files named `page.tsx` render HTML. Files named `route.ts` handle HTTP requests (like a REST API). This convention eliminates manual route configuration.

---

## Authentication Flow

### Why OAuth?

CEP Hero needs to call Google APIs on behalf of the administrator. OAuth 2.0 lets the user grant specific permissions (called "scopes") without sharing their password.

### The Scopes

When a user signs in, they authorize these permissions:

```typescript
scope: [
  "https://www.googleapis.com/auth/chrome.management.reports.readonly",
  "https://www.googleapis.com/auth/chrome.management.policy",
  "https://www.googleapis.com/auth/cloud-identity.policies",
  "https://www.googleapis.com/auth/admin.directory.orgunit",
  // ... more scopes
];
```

Each scope unlocks specific API capabilities:

- **chrome.management.reports.readonly** — Read Chrome audit events
- **chrome.management.policy** — Read and write Chrome policies
- **cloud-identity.policies** — Manage DLP rules
- **admin.directory.orgunit** — List organizational units

### How It Works

1. User visits `/sign-in`
2. Better Auth redirects to Google's OAuth consent screen
3. User grants permissions
4. Google redirects back with an authorization code
5. Better Auth exchanges the code for access and refresh tokens
6. Tokens are stored in a session cookie

The access token is then used for all Google API calls:

```typescript
// In an API route
const session = await auth.api.getSession({ headers: req.headers });
const { accessToken } = await auth.api.getAccessToken({
  body: { providerId: "google" },
  headers: req.headers,
});

// Use accessToken to call Google APIs
const executor = new CepToolExecutor(accessToken);
```

### Configuration

Authentication is configured in `lib/auth.ts`:

```typescript
export const auth = betterAuth({
  socialProviders: {
    google: {
      clientId: getRequiredEnv("GOOGLE_CLIENT_ID"),
      clientSecret: getRequiredEnv("GOOGLE_CLIENT_SECRET"),
      accessType: "offline", // Get refresh token
      prompt: "consent", // Always show consent screen
      scope: [
        /* ... */
      ],
    },
  },
  session: {
    cookieCache: { enabled: true, maxAge: 12 * 60 * 60 },
  },
});
```

The `accessType: "offline"` is important—it ensures we get a refresh token so the app can continue working even after the access token expires.

---

## The MCP Tool System

MCP stands for "Model Context Protocol." In this codebase, it refers to the tools that the AI can invoke to gather data or take actions.

### The ToolExecutor Interface

Every tool is defined in a single interface (`lib/mcp/types.ts`):

```typescript
export interface ToolExecutor {
  getChromeEvents(args: GetChromeEventsArgs): Promise<ChromeEventsResult>;
  listDLPRules(args?: ListDLPRulesArgs): Promise<ListDLPRulesResult>;
  listOrgUnits(): Promise<ListOrgUnitsResult>;
  getChromeConnectorConfiguration(): Promise<ConnectorConfigResult>;
  draftPolicyChange(
    args: DraftPolicyChangeArgs
  ): Promise<DraftPolicyChangeResult>;
  applyPolicyChange(
    args: ApplyPolicyChangeArgs
  ): Promise<ApplyPolicyChangeResult>;
  createDLPRule(args: CreateDLPRuleArgs): Promise<CreateDLPRuleResult>;
  getFleetOverview(args: GetFleetOverviewArgs): Promise<FleetOverviewResponse>;
  enrollBrowser(args: EnrollBrowserArgs): Promise<EnrollBrowserResult>;
  debugAuth(): Promise<DebugAuthResult>;
}
```

This interface is implemented twice:

1. **`CepToolExecutor`** — Calls real Google APIs (production)
2. **`FixtureToolExecutor`** — Returns predetermined data (testing)

This pattern is called **dependency injection**. The chat service doesn't know which implementation it's using; it just calls the interface methods.

### Input Validation with Zod

Each tool has a schema that validates its inputs (`lib/mcp/schemas.ts`):

```typescript
export const GetChromeEventsSchema = z.object({
  maxResults: z.number().min(1).max(1000).optional().default(50),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  pageToken: z.string().optional(),
});
```

Zod schemas serve three purposes:

1. **Runtime validation** — Reject invalid inputs before calling APIs
2. **TypeScript types** — `z.infer<typeof GetChromeEventsSchema>` generates the type
3. **AI tool definitions** — The schema tells the LLM what parameters each tool accepts

### The Production Executor

`CepToolExecutor` (`lib/mcp/executor/index.ts`) coordinates all Google API calls:

```typescript
export class CepToolExecutor implements ToolExecutor {
  private auth: OAuth2Client;
  private customerId: string;
  private orgUnitContext: OrgUnitContext | null = null;

  constructor(accessToken: string, customerId?: string) {
    this.auth = new OAuth2Client();
    this.auth.setCredentials({ access_token: accessToken });
    this.customerId = customerId ?? "my_customer";
  }

  async getChromeEvents(args: GetChromeEventsArgs) {
    return fetchChromeEvents(this.auth, this.customerId, args);
  }

  // Each method delegates to a specialized module
}
```

Each tool has its own implementation file in `lib/mcp/executor/`:

| File               | Purpose                                           |
| ------------------ | ------------------------------------------------- |
| `chrome-events.ts` | Queries Chrome audit events from Admin SDK        |
| `connector.ts`     | Resolves connector policies via Chrome Policy API |
| `dlp-list.ts`      | Lists DLP rules from Cloud Identity API           |
| `policy.ts`        | Drafts and applies policy changes                 |
| `enrollment.ts`    | Generates browser enrollment tokens               |
| `org-units-api.ts` | Lists organizational units                        |

---

## How the Chat Works

The chat system has three layers: the API route, the chat service, and the React context.

### Layer 1: The API Route

`app/api/chat/route.ts` handles HTTP POST requests:

```typescript
export async function POST(req: Request) {
  // 1. Authenticate
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Get access token
  const { accessToken } = await auth.api.getAccessToken({ ... });

  // 3. Parse request body
  const body = await req.json();
  const messages = body.messages;

  // 4. Create executor (production or fixture-based)
  const isTestMode = req.headers.get("x-eval-test-mode") === "1";
  const executor = isTestMode
    ? new FixtureToolExecutor(body.fixtures)
    : new CepToolExecutor(accessToken);

  // 5. Stream response
  const result = await createChatStream({ messages, executor });
  return result.toDataStreamResponse();
}
```

### Layer 2: The Chat Service

`lib/chat/chat-service.ts` orchestrates the AI conversation:

```typescript
export async function createChatStream({ messages, executor }) {
  const result = streamText({
    model: google("gemini-2.0-flash-001"),
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    tools: {
      getChromeEvents: tool({
        description: "Get recent Chrome events.",
        inputSchema: GetChromeEventsSchema,
        execute: (args) => executor.getChromeEvents(args),
      }),
      listDLPRules: tool({
        description: "List DLP rules.",
        inputSchema: ListDLPRulesSchema,
        execute: (args) => executor.listDLPRules(args),
      }),
      // ... more tools
    },
  });

  return result;
}
```

The `streamText` function from the Vercel AI SDK:

1. Sends the conversation to Gemini
2. If Gemini wants to call a tool, it pauses and returns the tool call
3. The SDK executes the tool via the `execute` function
4. The tool result is sent back to Gemini
5. Gemini continues reasoning
6. The final response streams back to the client

### Layer 3: The React Context

`components/chat/chat-context.tsx` provides chat state to the entire app:

```typescript
export function ChatProvider({ children }) {
  const chat = useChat({
    api: "/api/chat",
    streamProtocol: "data",
  });

  return (
    <ChatContext.Provider value={chat}>
      {children}
    </ChatContext.Provider>
  );
}
```

The `useChat` hook from the AI SDK handles:

- Sending messages to the API
- Streaming responses
- Managing message history
- Tracking loading state

Components anywhere in the app can access chat state:

```typescript
function SomeComponent() {
  const { messages, sendMessage, status } = useChatContext();
  // ...
}
```

### The System Prompt

The system prompt (`lib/chat/chat-service.ts`) shapes how the AI behaves:

```typescript
const systemPrompt = `You are CEP Hero, a troubleshooting expert for Chrome Enterprise Premium.

# Your Capabilities
You CAN:
- Fetch and analyze Chrome events, DLP rules, and connector configurations
- Diagnose policy scoping issues and configuration problems
- Draft policy change proposals using the draftPolicyChange tool
- Apply policy changes after user confirmation

You CANNOT:
- Execute changes without explicit user confirmation

# Policy Change Workflow
1. Explain the issue and what needs to change
2. Use draftPolicyChange to propose the change
3. Wait for user to say "Confirm"
4. Call applyPolicyChange with exact values from the draft

# Evidence Requirements
- Cite EXACT field values from tool results
- Quote error codes verbatim
- Mention specific counts
...`;
```

This prompt establishes:

- What the AI can and cannot do
- The confirmation workflow for policy changes
- How to cite evidence
- How to format responses

---

## The Fleet Overview Dashboard

The dashboard shows a high-level view of the Chrome Enterprise deployment.

### Two-Layer Architecture

The dashboard uses an **evidence-first** pattern:

**Layer 1: Deterministic Extraction** (`lib/mcp/fleet-overview/extract.ts`)

```typescript
export function extractFleetOverviewFacts(
  data: RawApiData
): FleetOverviewFacts {
  return {
    eventCount: data.events?.length ?? 0,
    blockedEventCount:
      data.events?.filter((e) => e.type === "BLOCKED").length ?? 0,
    dlpRuleCount: data.dlpRules?.length ?? 0,
    connectorPolicyCount: data.connectorPolicies?.length ?? 0,
    // ... more facts
  };
}
```

This function is pure—no AI, no side effects. Given the same input, it always returns the same output. This makes it easy to test and debug.

**Layer 2: AI Summarization** (`lib/mcp/fleet-overview/summarize.ts`)

```typescript
export async function summarizeFleetOverview(facts: FleetOverviewFacts) {
  const result = await generateObject({
    model: google("gemini-2.0-flash"),
    schema: FleetOverviewResponseSchema,
    prompt: `Given these facts about a Chrome Enterprise deployment:
      - ${facts.eventCount} events in the last 24 hours
      - ${facts.blockedEventCount} blocked events
      - ${facts.dlpRuleCount} DLP rules configured

      Generate a summary with status cards and recommendations.`,
  });

  return result.object;
}
```

The AI receives structured facts, not raw API responses. This:

- Reduces token usage
- Makes prompts more predictable
- Keeps the AI focused on summarization, not data parsing

### The Dashboard Component

`components/cep/dashboard-overview.tsx` renders the overview:

```typescript
export function DashboardOverview() {
  const { data, isLoading } = useSWR("/api/overview", fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div>
      <h1>{data.headline}</h1>
      <p>{data.summary}</p>

      <div className="cards">
        {data.postureCards.map((card) => (
          <PostureCard key={card.label} {...card} />
        ))}
      </div>

      <Suggestions items={data.suggestions} />
    </div>
  );
}
```

SWR is a data fetching library that handles caching, revalidation, and loading states.

---

## The Draft-and-Apply Pattern

Policy changes are destructive—they affect real users. CEP Hero uses a two-step confirmation pattern.

### Step 1: Draft

When the AI identifies a needed change, it calls `draftPolicyChange`:

```typescript
const draft = await executor.draftPolicyChange({
  policyName: "Enable Cookie Encryption",
  proposedValue: { cookieEncryptionEnabled: true },
  targetUnit: "orgunits/03ph8a2z23yjui6",
  reasoning: "Cookie encryption prevents session hijacking",
});
```

The draft returns:

```typescript
{
  ui: {
    type: "confirmation",
    title: "Enable Cookie Encryption",
    description: "This will encrypt cookies for /Engineering",
  },
  applyParams: {
    policySchemaId: "chrome.users.CookieEncryption",
    targetResource: "orgunits/03ph8a2z23yjui6",
    value: { cookieEncryptionEnabled: true },
  },
  status: "pending_confirmation",
}
```

### Step 2: UI Confirmation

The chat console renders a confirmation card:

```typescript
function PolicyChangeConfirmation({ draft }) {
  return (
    <Card>
      <h3>{draft.ui.title}</h3>
      <p>{draft.ui.description}</p>
      <p className="muted">Say "Confirm" to apply this change.</p>
    </Card>
  );
}
```

### Step 3: Apply

When the user says "Confirm", the chat console detects it:

```typescript
const CONFIRM_PATTERN = /^confirm\b/i;

function handleSubmit(message: string) {
  if (CONFIRM_PATTERN.test(message)) {
    // The AI will see this and call applyPolicyChange
    // with the exact applyParams from the draft
  }
  sendMessage({ text: message });
}
```

The AI then calls `applyPolicyChange` with the stored parameters:

```typescript
const result = await executor.applyPolicyChange({
  policySchemaId: "chrome.users.CookieEncryption",
  targetResource: "orgunits/03ph8a2z23yjui6",
  value: { cookieEncryptionEnabled: true },
});
```

This pattern ensures:

- Users see exactly what will change before it happens
- The AI cannot modify parameters between draft and apply
- Accidental changes are prevented

---

## Testing with Fixtures

Real Google API calls are slow, flaky, and require authentication. Fixtures solve this.

### What's a Fixture?

A fixture is a predetermined API response:

```json
{
  "auditEvents": {
    "items": [
      {
        "kind": "admin#reports#activity",
        "id": { "time": "2024-01-15T10:30:00Z" },
        "events": [{ "type": "BLOCK", "name": "DLP_VIOLATION" }]
      }
    ]
  },
  "dlpRules": [{ "name": "Block PII uploads", "action": "BLOCK" }]
}
```

### The Fixture Executor

`FixtureToolExecutor` returns fixture data instead of calling APIs:

```typescript
export class FixtureToolExecutor implements ToolExecutor {
  private fixtures: FixtureData;

  constructor(fixtures: FixtureData) {
    this.fixtures = fixtures;
  }

  async getChromeEvents(args) {
    // Return fixture data, not real API response
    return {
      events: this.fixtures.auditEvents?.items ?? [],
      nextPageToken: null,
    };
  }
}
```

### Fixture Injection

The chat API route checks for test mode:

```typescript
const isTestMode = req.headers.get("x-eval-test-mode") === "1";
const fixtures = body.fixtures;

const executor =
  isTestMode && fixtures
    ? new FixtureToolExecutor(fixtures)
    : new CepToolExecutor(accessToken);
```

The chat context can inject fixtures automatically in demo mode:

```typescript
const sendMessage = useCallback((message, options) => {
  if (isFixtureMode && activeFixture) {
    return originalSendMessage(message, {
      ...options,
      headers: { "x-eval-test-mode": "1" },
      body: { fixtures: activeFixture.data },
    });
  }
  return originalSendMessage(message, options);
}, []);
```

---

## The Evaluation Framework

Evals test whether the AI gives good answers. They're automated, reproducible, and measure specific quality criteria.

### Eval Structure

Each eval case has:

1. **A prompt** (what the user asks)
2. **Fixtures** (what data the tools return)
3. **Assertions** (what the response must contain)

Example case definition (`evals/registry.json`):

```json
{
  "id": "EC-001",
  "title": "Network connectivity during enrollment",
  "category": "enrollment",
  "expected_schema": ["diagnosis", "evidence", "hypotheses", "next_steps"],
  "required_evidence": ["ERR_NAME_NOT_RESOLVED", "connection"],
  "required_tool_calls": ["getChromeEvents"]
}
```

### Running Evals

```bash
# Run all evals with fixture injection
EVAL_FIXTURES=1 bun run evals

# Run specific cases
EVAL_FIXTURES=1 bun run evals --cases EC-001,EC-002

# Generate HTML report
EVAL_FIXTURES=1 bun run evals --html
```

### Assertions

The eval runner checks multiple criteria:

1. **Schema** — Does the response contain required sections (diagnosis, evidence, etc.)?
2. **Evidence** — Does the response cite specific keywords from the fixture data?
3. **Tool Calls** — Did the AI call the expected tools?
4. **Forbidden Evidence** — Does the response avoid mentioning things it shouldn't?

### The LLM Judge

Some assertions are subjective. The LLM judge uses a second AI to evaluate responses:

```typescript
const judgeResult = await generateObject({
  model: google("gemini-2.5-pro"),
  schema: JudgeResponseSchema,
  prompt: `Evaluate this diagnostic response:

    Response: ${response}
    Required evidence: ${requiredEvidence}

    Did the response adequately address the evidence requirements?`,
});
```

This handles cases where the AI uses different wording than expected but still provides correct information.

### HTML Reports

Eval reports show detailed results for each case:

```
evals/reports/comprehensive-2026-02-05T03-02-45-755Z.html
```

Reports include:

- Pass/fail status with percentages
- Category breakdowns
- Expandable case details (prompt, response, assertions)
- Filter controls for quick triage

---

## Data Flow: End-to-End Example

Let's trace what happens when a user asks: "Why are users getting DLP blocks?"

### 1. User Submits Message

The chat console captures the input and calls `sendMessage`:

```typescript
// components/chat/chat-console.tsx
const handleSubmit = (text: string) => {
  sendMessage({ text });
};
```

### 2. Request Reaches API

The message goes to `/api/chat`:

```typescript
// app/api/chat/route.ts
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  const { accessToken } = await auth.api.getAccessToken({ ... });
  const body = await req.json();

  const executor = new CepToolExecutor(accessToken);
  const result = await createChatStream({
    messages: body.messages,
    executor,
  });

  return result.toDataStreamResponse();
}
```

### 3. AI Decides to Call Tools

Gemini receives the conversation and decides to gather evidence:

```
AI thinks: "I need to see recent DLP events and current rules."
AI calls: getChromeEvents({ maxResults: 50 })
AI calls: listDLPRules()
```

### 4. Tools Execute

The chat service runs the tool calls:

```typescript
// lib/chat/chat-service.ts
tools: {
  getChromeEvents: tool({
    execute: (args) => executor.getChromeEvents(args),
  }),
}
```

The executor calls the Google Admin SDK:

```typescript
// lib/mcp/executor/chrome-events.ts
export async function fetchChromeEvents(auth, customerId, args) {
  const admin = google.admin({ version: "reports_v1", auth });
  const response = await admin.activities.list({
    userKey: "all",
    applicationName: "chrome",
    maxResults: args.maxResults,
  });
  return { events: response.data.items };
}
```

### 5. AI Reasons Over Results

Gemini receives the tool results and generates a response:

```
AI receives: { events: [{ type: "DLP_BLOCK", ... }], dlpRules: [...] }
AI responds: "Based on the Chrome events, I can see 15 DLP blocks in the last 24 hours.
             The blocks are triggered by the 'Block sensitive uploads' rule.
             Evidence: EVENT_TYPE: DLP_BLOCK, DESTINATION: drive.google.com..."
```

### 6. Response Streams to Client

The response streams back through the data stream protocol:

```typescript
// The AI SDK handles chunking and streaming
return result.toDataStreamResponse();
```

### 7. UI Renders Response

The chat console parses and renders the response:

```typescript
// components/chat/chat-console.tsx
{messages.map((message) => (
  <MessageBubble key={message.id}>
    {message.role === "assistant" && (
      <>
        <StreamingText text={message.text} />
        {message.toolCalls?.map((call) => (
          <ToolOutput key={call.id} call={call} />
        ))}
      </>
    )}
  </MessageBubble>
))}
```

Tool outputs get specialized renderers:

```typescript
function ToolOutput({ call }) {
  switch (call.toolName) {
    case "getChromeEvents":
      return <ChromeEventsTable events={call.result.events} />;
    case "listDLPRules":
      return <DLPRulesList rules={call.result.rules} />;
    // ...
  }
}
```

---

## Key Architectural Decisions

### 1. Dependency Injection for Executors

The `ToolExecutor` interface allows swapping implementations without changing the chat service:

```typescript
// Production
const executor = new CepToolExecutor(accessToken);

// Testing
const executor = new FixtureToolExecutor(fixtures);

// Both work identically with the chat service
const result = await createChatStream({ messages, executor });
```

### 2. Evidence-First Reasoning

The AI never invents data. Every claim must be grounded in tool results:

```
System prompt: "Cite EXACT field values from tool results (e.g., 'SOURCE_APP: Salesforce')"
```

This makes responses verifiable and trustworthy.

### 3. Streaming Responses

The AI SDK streams responses token-by-token:

```typescript
const result = streamText({ ... });
return result.toDataStreamResponse();
```

Users see responses appear in real-time rather than waiting for the full response.

### 4. Confirmation Before Mutation

Policy changes require explicit confirmation:

```
1. AI: "I recommend enabling cookie encryption. [Draft created]"
2. User: "Confirm"
3. AI: [Applies change] "Done. Cookie encryption is now enabled."
```

This prevents accidental changes and gives users control.

### 5. Structured AI Output

AI responses are validated against Zod schemas:

```typescript
const result = await generateObject({
  schema: FleetOverviewResponseSchema,
  // ...
});
```

This ensures consistent, typed output from the AI.

### 6. Separation of Concerns

Each layer has a single responsibility:

| Layer        | Responsibility                                      |
| ------------ | --------------------------------------------------- |
| API Route    | Authentication, request parsing, executor selection |
| Chat Service | AI orchestration, tool definitions, system prompt   |
| Executor     | Google API calls                                    |
| Components   | UI rendering, user interaction                      |

### 7. Test Isolation via Fixtures

Fixtures make tests deterministic:

- Same input → Same output
- No network dependencies
- No authentication required
- Fast execution

---

## Appendix: File Reference

### Core Files

| Path                          | Purpose                                     |
| ----------------------------- | ------------------------------------------- |
| `lib/auth.ts`                 | Better Auth configuration with Google OAuth |
| `lib/chat/chat-service.ts`    | AI orchestration with Gemini                |
| `lib/mcp/types.ts`            | ToolExecutor interface and result types     |
| `lib/mcp/executor/index.ts`   | Production executor (CepToolExecutor)       |
| `lib/mcp/fixture-executor.ts` | Test executor (FixtureToolExecutor)         |

### API Routes

| Path                             | Purpose                 |
| -------------------------------- | ----------------------- |
| `app/api/auth/[...all]/route.ts` | OAuth endpoints         |
| `app/api/chat/route.ts`          | Chat streaming endpoint |
| `app/api/overview/route.ts`      | Fleet dashboard data    |

### Components

| Path                                    | Purpose                             |
| --------------------------------------- | ----------------------------------- |
| `components/cep/app-shell.tsx`          | Main layout with dashboard and chat |
| `components/cep/dashboard-overview.tsx` | Fleet posture cards                 |
| `components/chat/chat-console.tsx`      | Chat UI                             |
| `components/chat/chat-context.tsx`      | Chat state management               |

### Evaluation

| Path                  | Purpose               |
| --------------------- | --------------------- |
| `evals/run.ts`        | CLI entry point       |
| `evals/lib/runner.ts` | Eval execution engine |
| `evals/registry.json` | Test case definitions |
| `evals/cases/*.md`    | Test prompts          |

---

## Next Steps

To understand specific parts in more depth:

1. **Authentication**: Start with `lib/auth.ts` and trace through `app/api/auth/`
2. **Tools**: Read `lib/mcp/types.ts` then explore `lib/mcp/executor/`
3. **Chat**: Follow `app/api/chat/route.ts` → `lib/chat/chat-service.ts`
4. **Evals**: Run `EVAL_FIXTURES=1 bun run evals --html` and inspect the output

For code standards and conventions, see `AGENTS.md`.
