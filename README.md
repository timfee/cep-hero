# Chrome Enterprise Premium (CEP) - MCP Server & AI Agent

This project is a dual-purpose application:

1.  **AI Admin Hero UI:** A Next.js-based Chat Interface for managing Chrome Enterprise Premium.
2.  **MCP Server:** A compliant [Model Context Protocol](https://modelcontextprotocol.io/) server that allows external agents (like Claude Desktop or Gemini CLI) to manage your Chrome fleet.

It connects to **REAL** Google Cloud APIs (Admin SDK, Chrome Management, Cloud Identity, Chrome Policy).

---

## 🛠️ Developer Setup (Required)

To run this application, you must create a Google Cloud Project and configure OAuth credentials.

### 1. Create Google Cloud Project & Enable APIs

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a new project (e.g., `cep-admin-hero`).
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
4.  Name: `CEP App`.
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

## 🧪 Testing Notes

- The live eval suite uses `X-Test-Bypass: 1` to avoid interactive auth.
- When test bypass is enabled, the server attempts service-account token minting with `GOOGLE_SERVICE_ACCOUNT_JSON` and `GOOGLE_TOKEN_EMAIL`.

Eval runs:

- `bun run evals:run` runs the full eval suite.
- `bun run evals:run:plan`, `evals:run:diag`, `evals:run:common` run a category.
- `EVAL_IDS=EC-075 bun run evals:run:by-id` runs a single case.
- `EVAL_TAGS=dlp bun run evals:run:by-tag` filters by tags.
- `TEST_PATTERN="EC-0(1|2|3)" bun run evals:run:pattern` filters by name.
- `EVAL_USE_BASE=1` and `EVAL_USE_FIXTURES=1` attach the base snapshot and fixtures.
- `bun run credentials:check` validates service-account setup for test bypass.

---

## 📂 Project Structure

- **`lib/mcp/registry.ts`**: Deterministic tools + evidence extraction + structured AI summaries.
- **`lib/mcp/server-factory.ts`**: MCP tool registrations and SSE transport.
- **`app/api/chat/route.ts`**: Chat endpoint that exposes tools to the UI.
- **`app/api/mcp/route.ts`**: MCP Server endpoint via Server-Sent Events (SSE).
- **`app/api/overview/route.ts`**: Fleet overview endpoint backed by `getFleetOverview`.
