# App Directory

See the root [AGENTS.md](../AGENTS.md) for project-wide coding standards.

## Scope

Next.js App Router UI and API routes.

## Directory Structure

- **`(auth)/`** - Authentication flow pages
- **`api/`** - API routes (chat, fixtures, MCP, auth)
- **`gimme/`** - Self-enrollment server actions
- Root pages and layouts

## Guidelines

- Keep handlers self-contained with runtime guards for request bodies
- Use concise TSDoc for exported functions
- Preserve structured logging; do not log secrets
- `/api/chat` supports `EVAL_TEST_MODE=1` for lightweight eval responses

## Testing

Files with `.test.tsx` should maintain their tests when modified.
