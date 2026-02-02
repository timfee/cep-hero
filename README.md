# CEP Hero - MCP Server & AI Agent

This project does two things:

1.  A Next.js chat UI for Chrome Enterprise Premium.
2.  An MCP server so external agents (Claude Desktop, Gemini CLI) can manage the fleet.

It talks to real Google Cloud APIs (Admin SDK, Chrome Management, Cloud Identity, Chrome Policy).

---

## 🛠️ Developer Setup (Required)

To run this application, you must create a Google Cloud Project and configure OAuth credentials.

### 1. Create Google Cloud Project & Enable APIs

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a new project (e.g., `cep-hero`).
3.  **Enable the following APIs** (API & Services > Library):
    - **Admin SDK** (`admin.googleapis.com`)
    - **Chrome Management API** (`chromemanagement.googleapis.com`)
    - **Cloud Identity API** (`cloudidentity.googleapis.com`)

### 2. Configure OAuth Consent Screen

1.  Go to **APIs & Services > OAuth consent screen**.
2.  Select **Internal** (if you are a Workspace user) or **External** (for testing).
3.  Fill in the app name and email.
4.  **Scopes:** Add the following scopes:
    - `https://www.googleapis.com/auth/chrome.management.reports.readonly`
    - `https://www.googleapis.com/auth/chrome.management.profiles.readonly`
    - `https://www.googleapis.com/auth/cloud-identity.policies`
    - `https://www.googleapis.com/auth/admin.reports.audit.readonly`
    - `https://www.googleapis.com/auth/cloud-platform`
    - `openid`, `email`, `profile`
5.  Save and continue.

### 3. Create OAuth Credentials

1.  Go to **APIs & Services > Credentials**.
2.  Click **Create Credentials > OAuth client ID**.
3.  Application type: **Web application**.
4.  Name: `CEP Hero`.
5.  **Authorized Redirect URIs** (Add BOTH):
    - `http://localhost:3000/api/auth/callback/google` (Web UI)
    - `http://localhost:3000/callback` (CLI Login script)
6.  Click **Create**.
7.  Copy the **Client ID** and **Client Secret**.

### 4. Environment Configuration

Create a `.env.local` file in the root of the project:

```bash
# Google OAuth Credentials (Required)
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here

# Better Auth Configuration
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=generate_a_random_string_here

# AI Configuration (Gemini API)
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key

# Upstash Vector (for grounding)
UPSTASH_VECTOR_REST_URL=your_vector_url
UPSTASH_VECTOR_REST_TOKEN=your_vector_token

# Optional: Service account for test bypass
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
GOOGLE_TOKEN_EMAIL=admin@your-domain.com
```

---

## 🚀 Usage Guide

### 1. Install Dependencies

```bash
bun install
```

### 2. Authentication (Choose One)

#### Option A: Web UI (Standard)

Just start the app. You will be prompted to sign in with Google when you visit the page.

```bash
bun dev
```

#### Option B: CLI / Headless Mode

Use an OAuth token from the web sign-in flow. Application Default Credentials and local credential files are not supported.

### 3. Connect External Agents (Claude/Gemini CLI)

**SSE Endpoint:** `http://localhost:3000/api/mcp`

**Authorization:**

- Use the same OAuth bearer token issued by the web UI session: `Authorization: Bearer <token>`.

#### Example `curl` Test

```bash
curl -N -H "Authorization: Bearer <token>" http://localhost:3000/api/mcp
```

---

## Testing & Evaluation

CEP-Hero uses two types of quality assurance: **unit tests** for code correctness and **evals** for AI behavior quality.

### Quick Start

```bash
# Run unit tests
bun test

# Run evals (start server first in another terminal with `bun run dev`)
EVAL_USE_BASE=1 EVAL_USE_FIXTURES=1 bun run evals:run:fast

# Run a specific eval
EVAL_IDS=EC-057 EVAL_USE_BASE=1 bun run evals:run:by-id
```

### Understanding Evals

Evals are behavioral tests for the AI assistant. They verify that given a troubleshooting scenario, the AI provides helpful, accurate, and actionable guidance. Unlike unit tests with binary pass/fail outcomes, evals assess quality along multiple dimensions.

The eval framework uses **fixture injection** to provide deterministic test data without calling live Google APIs. This enables fast, reproducible, quota-free testing while exercising the full AI reasoning pipeline.

### Documentation

For comprehensive eval documentation, see:

- **[QUEST_INSTRUCTIONS.md](./QUEST_INSTRUCTIONS.md)** - Complete guide to understanding, running, and improving evals
- **[QUEST_TASKS.md](./QUEST_TASKS.md)** - Progress tracking for eval system improvements
- **[evals/README.md](./evals/README.md)** - Eval-specific details and fixture format

### Common Commands

```bash
# Run all evals (server already running)
bun run evals:run:fast

# Run by category
bun run evals:run:diag:fast    # Diagnostics
bun run evals:run:plan:fast    # Test Plan
bun run evals:run:common:fast  # Common Challenges

# Run with strict checking
EVAL_STRICT_EVIDENCE=1 EVAL_USE_BASE=1 bun run evals:run:fast

# Capture live fixtures
bun run fixtures:capture
```

---

## 📂 Project Structure

- **`lib/mcp/registry.ts`**: Deterministic tools + evidence extraction + structured AI summaries.
- **`lib/mcp/server-factory.ts`**: MCP tool registrations and SSE transport.
- **`app/api/chat/route.ts`**: Chat endpoint that exposes tools to the UI.
- **`app/api/mcp/route.ts`**: MCP Server endpoint via Server-Sent Events (SSE).
- **`app/api/overview/route.ts`**: Fleet overview endpoint backed by `getFleetOverview`.
