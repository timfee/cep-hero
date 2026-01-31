# CEP MCP Server - Real World Setup Guide

This prototype is designed to interact with **real** Google Cloud and Chrome Enterprise APIs. To use it, you must configure a Google Cloud Project and OAuth credentials.

## 1. Google Cloud Project Setup

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a new project (e.g., `cep-gemini-cli`).
3.  **Enable APIs:**
    - Navigate to **APIs & Services > Library**.
    - Search for and enable the following APIs:
      - **Admin SDK** (`admin.googleapis.com`)
      - **Chrome Management API** (`chromemanagement.googleapis.com`)

- **Cloud Identity API** (`cloudidentity.googleapis.com`)
- **Chrome Policy API** (`chromepolicy.googleapis.com`)

## 2. OAuth Consent Screen

1.  Go to **APIs & Services > OAuth consent screen**.
2.  Select **Internal** (if you are a Workspace user) or **External** (for testing).
3.  Fill in the app name ("CEP Gemini CLI") and email.
4.  **Scopes:** Add the following scopes:
    - `https://www.googleapis.com/auth/chrome.management.reports.readonly`
    - `https://www.googleapis.com/auth/cloud-platform`
    - `https://www.googleapis.com/auth/chrome.management.profiles.readonly`
    - `https://www.googleapis.com/auth/cloud-identity.policies`
    - `https://www.googleapis.com/auth/admin.reports.audit.readonly`
    - `openid`, `email`, `profile`
5.  Save and continue.

## 3. Create OAuth Credentials

1.  Go to **APIs & Services > Credentials**.
2.  Click **Create Credentials > OAuth client ID**.
3.  Application type: **Web application**.
4.  Name: `CEP NextJS App`.
5.  **Authorized redirect URIs:**
    - `http://localhost:3000/api/auth/callback/google`
6.  Click **Create**.
7.  Copy the **Client ID** and **Client Secret**.

## 4. Environment Configuration

Create a `.env.local` file in the root of the project:

```bash
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=generate_a_random_string_here
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key
UPSTASH_VECTOR_REST_URL=your_vector_url
UPSTASH_VECTOR_REST_TOKEN=your_vector_token

# Optional: service account for test bypass
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
GOOGLE_TOKEN_EMAIL=admin@your-domain.com
```

## 5. Running the App

```bash
bun dev
```

Visit `http://localhost:3000`. You will be prompted to sign in with your Google Workspace account. Once signed in, the "Gemini CLI" will have a real Access Token to perform operations on your behalf.
