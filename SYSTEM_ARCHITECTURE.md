# System Architecture

## Layer Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ENTRY POINTS                                │
│                                                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────────────────┐ │
│  │  Browser UI   │   │  MCP Client  │   │  Eval Runner / Dashboard│ │
│  │  /api/chat    │   │  /api/mcp    │   │  evals/run.ts  /api/…  │ │
│  └──────┬───────┘   └──────┬───────┘   └────────────┬────────────┘ │
└─────────┼──────────────────┼────────────────────────┼───────────────┘
          │                  │                        │
          ▼                  ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     AUTH  (Better Auth + Google OAuth)               │
│  Session cookie / Bearer token / Service-account fallback           │
│  → resolves OAuth2 access token for downstream API calls            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      TOOL EXECUTOR LAYER                            │
│                                                                     │
│  ┌────────────────────────┐     ┌────────────────────────────────┐  │
│  │   CepToolExecutor      │     │   FixtureToolExecutor          │  │
│  │   (production — calls  │     │   (eval — returns deterministic│  │
│  │    Google APIs)         │     │    fixture JSON, no API calls) │  │
│  └───────────┬────────────┘     └────────────────────────────────┘  │
│              │  Both implement ToolExecutor (lib/mcp/types.ts)      │
└──────────────┼──────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       GOOGLE WORKSPACE APIs                         │
│                                                                     │
│  Admin SDK ·  Chrome Policy ·  Chrome Mgmt ·  Cloud Identity ·  Dir│
│  reports_v1    v1               v1             v1beta1          v1  │
└─────────────────────────────────────────────────────────────────────┘
```

## Chat Request Lifecycle

```
User message
     │
     ▼
 /api/chat (POST)
     │
     ├─ Authenticate (session cookie → access token)
     │
     ├─ retrieveKnowledge()
     │   ├─ analyzeIntent() — Gemini classifies query
     │   └─ fetchKnowledgeSnippets() — Upstash vector search
     │       returns docs + policy hits, appended to system prompt
     │
     ├─ createChatStream()
     │   ├─ Gemini streamText() with prepareStep guards
     │   ├─ Tool calls → ToolExecutor methods → Google APIs
     │   └─ Returns SSE stream (toUIMessageStreamResponse)
     │
     ▼
 React useChat() hook
     │
     ├─ Parses SSE frames
     └─ Renders tool parts as rich cards:
         EventsTable · DlpRulesCard · ConnectorPoliciesCard
         PolicyChangeConfirmation · ToolResultCard · PostureCard
```

## Tool → API Mapping

| Tool                              | Executor Method                     | Google API                               |
| --------------------------------- | ----------------------------------- | ---------------------------------------- |
| `getChromeEvents`                 | `getChromeEvents()`                 | Admin SDK `reports_v1` activities.list   |
| `listDLPRules`                    | `listDLPRules()`                    | Cloud Identity `v1beta1` policies.list   |
| `createDLPRule`                   | `createDLPRule()`                   | Cloud Identity `v1beta1` policies.create |
| `enrollBrowser`                   | `enrollBrowser()`                   | Chrome Management `v1` enrollmentTokens  |
| `listOrgUnits`                    | `listOrgUnits()`                    | Admin Directory `v1` orgunits.list       |
| `getChromeConnectorConfiguration` | `getChromeConnectorConfiguration()` | Chrome Policy `v1` policies.resolve      |
| `getFleetOverview`                | `getFleetOverview()`                | Aggregates events + DLP + connector      |
| `draftPolicyChange`               | `draftPolicyChange()`               | Chrome Policy `v1` (read-only draft)     |
| `applyPolicyChange`               | `applyPolicyChange()`               | Chrome Policy `v1` batchModify           |
| `searchKnowledge`                 | `searchDocs()` / `searchPolicies()` | Upstash Vector (not a Google API)        |

## Key Files

| Layer            | File                                   |
| ---------------- | -------------------------------------- |
| Chat API route   | `app/api/chat/route.ts`                |
| MCP API route    | `app/api/mcp/route.ts`                 |
| Overview route   | `app/api/overview/route.ts`            |
| Chat service     | `lib/chat/chat-service.ts`             |
| MCP server       | `lib/mcp/server-factory.ts`            |
| ToolExecutor     | `lib/mcp/types.ts`                     |
| CepToolExecutor  | `lib/mcp/executor/index.ts`            |
| FixtureExecutor  | `lib/mcp/fixture-executor.ts`          |
| Auth             | `lib/auth.ts`                          |
| Knowledge search | `lib/upstash/search.ts`                |
| Eval runner      | `evals/run.ts` → `evals/lib/runner.ts` |
| Rich cards       | `components/ai-elements/*.tsx`         |

---

See [WALKTHROUGH.md](WALKTHROUGH.md) for a detailed code walkthrough and [README.md](README.md) for setup instructions.
