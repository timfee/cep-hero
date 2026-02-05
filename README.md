# CEP Hero - MCP Server & AI Agent

This project does two things:

1.  A Next.js chat UI for Chrome Enterprise Premium.
2.  An MCP server so external agents (Claude Desktop, Gemini CLI) can manage the fleet.

It talks to real Google Cloud APIs (Admin SDK, Chrome Management, Cloud Identity, Chrome Policy).

---

## Developer Setup (Required)

To run this application, you must create a Google Cloud Project and configure OAuth credentials.

### 1. Create Google Cloud Project & Enable APIs

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a new project (e.g., `cep-hero`).
3.  **Enable the following APIs** (API & Services > Library):
    - **Admin SDK** (`admin.googleapis.com`) - For audit logs, org units, users, groups
    - **Chrome Management API** (`chromemanagement.googleapis.com`) - For Chrome reports and profiles
    - **Chrome Policy API** (`chromepolicy.googleapis.com`) - For reading/writing Chrome policies
    - **Cloud Identity API** (`cloudidentity.googleapis.com`) - For DLP rules and Cloud Identity policies

### 2. Configure OAuth Consent Screen

1.  Go to **APIs & Services > OAuth consent screen**.
2.  Select **Internal** (if you are a Workspace user) or **External** (for testing).
3.  Fill in the app name and email.
4.  **Scopes:** Add the following scopes:
    - `https://www.googleapis.com/auth/chrome.management.reports.readonly` - Read Chrome reports
    - `https://www.googleapis.com/auth/chrome.management.profiles.readonly` - Read Chrome profiles
    - `https://www.googleapis.com/auth/chrome.management.policy` - **Read/write Chrome policies** (required for applying policy changes)
    - `https://www.googleapis.com/auth/cloud-identity.policies` - **Read/write Cloud Identity policies** (required for creating DLP rules)
    - `https://www.googleapis.com/auth/admin.reports.audit.readonly` - Read audit logs
    - `https://www.googleapis.com/auth/admin.directory.orgunit` - Read/write org units
    - `https://www.googleapis.com/auth/admin.directory.group` - Read groups
    - `https://www.googleapis.com/auth/admin.directory.user` - Read users
    - `https://www.googleapis.com/auth/cloud-platform` - Cloud platform access
    - `https://www.googleapis.com/auth/ediscovery` - eDiscovery access
    - `openid`, `email`, `profile` - Basic identity
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

# Optional: Service account for test bypass and self-enrollment
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
GOOGLE_TOKEN_EMAIL=admin@your-domain.com

# Self-enrollment password for /api/gimme endpoint
SELF_ENROLLMENT_PASSWORD=your_secret_enrollment_password
```

### 5. Service Account Setup (For Integration Tests)

Integration tests require a service account with **domain-wide delegation** to call Google Workspace Admin APIs.

#### Create Service Account

1. Go to **Google Cloud Console > IAM & Admin > Service Accounts**
2. Click **Create Service Account**
3. Name it (e.g., `cep-hero-testing`)
4. Grant no roles (delegation provides access)
5. Click **Done**, then click the service account
6. Go to **Keys > Add Key > Create new key > JSON**
7. Save the downloaded JSON file

#### Enable Domain-Wide Delegation

1. On the service account page, click **Show domain-wide delegation**
2. Check **Enable Google Workspace Domain-wide Delegation**
3. Copy the **Client ID** (numeric)

#### Authorize in Admin Console

1. Go to **Admin Console > Security > Access and data control > API controls**
2. Click **Manage Domain-wide Delegation**
3. Click **Add new**
4. Enter the **Client ID** from above
5. Add these **OAuth scopes** (comma-separated):
   ```
   https://www.googleapis.com/auth/admin.directory.user,
   https://www.googleapis.com/auth/admin.directory.orgunit,
   https://www.googleapis.com/auth/chrome.management.policy,
   https://www.googleapis.com/auth/chrome.management.policy.readonly,
   https://www.googleapis.com/auth/cloud-identity.policies,
   https://www.googleapis.com/auth/cloud-identity.policies.readonly
   ```
6. Click **Authorize**

#### Configure Environment

Add to `.env.local`:

```bash
# Service account JSON (minified or pretty-printed both work)
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'

# Admin email for impersonation (must be a super admin)
GOOGLE_TOKEN_EMAIL=admin@your-domain.com

# Optional: Customer ID (auto-detected if not set)
GOOGLE_CUSTOMER_ID=C01234567
```

---

## Usage Guide

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

**Streamable HTTP Endpoint:** `http://localhost:3000/api/mcp`

**Authorization:**

- Use the same OAuth bearer token issued by the web UI session: `Authorization: Bearer <token>`.

**Client headers (MCP Streamable HTTP):**

- Initialization requests must `POST` with `Accept: application/json, text/event-stream` and `Content-Type: application/json`.
- After initialization, include `Mcp-Session-Id: <sessionId>` on all requests.
- For event streams, `GET` with `Accept: text/event-stream` and `Mcp-Session-Id`.

#### Example `curl` Test (Initialize)

```bash
curl -N \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -X POST \
  --data '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"initialize",
    "params":{
      "protocolVersion":"2025-03-26",
      "capabilities":{},
      "clientInfo":{"name":"curl","version":"1.0.0"}
    }
  }' \
  http://localhost:3000/api/mcp
```

---

## Testing & Evaluation

CEP-Hero uses two types of quality assurance: **unit tests** for code correctness and **evals** for AI behavior quality.

### Quick Start

```bash
# Run unit tests
bun test

# Run integration tests (requires service account)
bun test tests/dlp-api.test.ts

# Run evals (server auto-starts)
EVAL_FIXTURES=1 bun run evals

# Run a specific eval
EVAL_IDS=EC-057 EVAL_FIXTURES=1 bun run evals
```

### Integration Tests

Integration tests validate live Google API behavior. They automatically skip when credentials are missing.

```bash
# DLP API tests (list, create, delete rules)
bun test tests/dlp-api.test.ts

# Validate DLP API directly
bun scripts/validate-dlp-api.ts
```

Tests verify:

- Cloud Identity API v1beta1 usage (required for DLP)
- Customer ID resolution
- DLP rule CRUD operations
- Error handling for permission issues

### Understanding Evals

Evals are behavioral tests for the AI assistant. They verify that given a troubleshooting scenario, the AI provides helpful, accurate, and actionable guidance. Unlike unit tests with binary pass/fail outcomes, evals assess quality along multiple dimensions.

The eval framework uses **fixture injection** to provide deterministic test data without calling live Google APIs. This enables fast, reproducible, quota-free testing while exercising the full AI reasoning pipeline.

### Documentation

For comprehensive eval documentation, see:

- **[evals/README.md](./evals/README.md)** - Eval-specific details and fixture format
- **[evals/cases/README.md](./evals/cases/README.md)** - Case index and category coverage

### Common Commands

```bash
# Run all evals
EVAL_FIXTURES=1 bun run evals

# Run by category
EVAL_CATEGORY=connector EVAL_FIXTURES=1 bun run evals
EVAL_CATEGORY=policy EVAL_FIXTURES=1 bun run evals
EVAL_CATEGORY=dlp EVAL_FIXTURES=1 bun run evals

# Run in serial mode (for rate limiting)
EVAL_SERIAL=1 EVAL_FIXTURES=1 bun run evals

# Capture live fixtures
bun run fixtures:capture
```

---

## Google API Notes

### Cloud Identity API (DLP Rules)

DLP rule operations require the **v1beta1** API version:

```typescript
const service = googleApis.cloudidentity({ version: "v1beta1", auth });
```

**Filter Limitations:** The Cloud Identity policies.list API only supports filtering by customer:

```
customer == "customers/{customerId}"
```

It does **NOT** support `setting.type.matches()` or other filter expressions. DLP rules are filtered client-side using the pattern `^rule\.dlp` on `setting.type`.

### Chrome Policy API

Uses **v1** for policy resolution and modification. The `my_customer` alias works for most operations.

---

## Project Structure

- **`lib/mcp/registry.ts`**: Central re-export hub for MCP schemas and executor.
- **`lib/mcp/executor/`**: CepToolExecutor implementation with Google API integrations.
- **`lib/mcp/server-factory.ts`**: MCP tool registrations and Streamable HTTP transport.
- **`lib/mcp/errors.ts`**: Unified `ApiResult<T>` type, type guards, and logging utilities.
- **`lib/mcp/constants.ts`**: Shared constants (MS_PER_DAY, CONNECTOR_POLICY_SCHEMAS).
- **`app/api/chat/route.ts`**: Chat endpoint that exposes tools to the UI.
- **`app/api/mcp/route.ts`**: MCP Server endpoint via Streamable HTTP.
- **`app/api/overview/route.ts`**: Fleet overview endpoint backed by `getFleetOverview`.

---

## Code Standards

For AI agents and contributors, see **[AGENTS.md](./AGENTS.md)** for:

- **API Result Pattern** - Use `ApiResult<T>` discriminated unions
- **Unified Logging** - Use `logApiRequest`, `logApiResponse`, `logApiError`
- **Shared Constants** - Add to `lib/mcp/constants.ts`
- **Anti-patterns to Avoid** - No barrel files, no duplicate types, no unnecessary wrappers

Quick commands:

```bash
bun x ultracite fix    # Auto-format code
bun x ultracite check  # Lint check
bun test               # Run tests
```
