# App Directory

See the root [AGENTS.md](../AGENTS.md) for project-wide coding standards.

## Scope

Next.js App Router UI and API routes.

## Directory Structure

- **`(auth)/`** - Authentication flow pages
  - `sign-in/page.tsx` - Sign-in page with side-by-side layout, domain context, and enhanced warnings
  - `layout.tsx`, `loading.tsx`, `error.tsx` - Auth route scaffolding
- **`api/`** - API routes
  - `auth/[...all]/route.ts` - Better Auth catch-all OAuth endpoints
  - `chat/route.ts` - AI chat streaming endpoint (executor selection, fixture injection)
  - `fixtures/route.ts` - List available fixture datasets
  - `fixtures/[id]/route.ts` - Get specific fixture data by ID
  - `mcp/route.ts` - MCP Streamable HTTP endpoint for external agents
  - `overview/route.ts` - Fleet overview endpoint backed by `getFleetOverview`
  - `sign-in-status/route.ts` - Auth status check endpoint
  - `sign-out/route.ts` - Sign-out handler
- **`sign-in-status/`** - Auth status display page
- **`page.tsx`** - Home page (redirects if not authenticated)
- **`layout.tsx`** - Root layout with providers
- **`loading.tsx`** - Root loading state
- **`error.tsx`** - Root error boundary
- **`globals.css`** - Global styles (markdown link contrast, dark mode, cursor-pointer)

## Guidelines

- Keep handlers self-contained with runtime guards for request bodies
- Use concise TSDoc for exported functions
- Preserve structured logging; do not log secrets
- `/api/chat` supports `EVAL_TEST_MODE=1` for lightweight eval responses
- The sign-in page uses `TARGET_DOMAIN` constant for consistent domain references in tests

## Testing

Files with `.test.tsx` should maintain their tests when modified. Test business logic and user-facing behavior rather than CSS class presence.
