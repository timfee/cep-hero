# Components Directory

See the root [AGENTS.md](../AGENTS.md) for project-wide coding standards.

## Directory Structure

- **`ai-elements/`** - AI-generated content display components
  - `diagnosis-card.tsx` - Diagnosis display with hypotheses
  - `evidence-panel.tsx` - Evidence collection visualization
  - `hypothesis-card.tsx` - Individual hypothesis with confidence scores
  - `policy-card.tsx` - Policy display and recommendation cards
  - `dlp-rules-card.tsx` - DLP rule visualization with org unit display
  - `connector-policies-card.tsx` - Connector policy configuration card with mis-scoping analysis
  - `connector-status.tsx` - Connector health status
  - `posture-card.tsx` - Security posture metrics
  - `events-table.tsx` - Chrome events in table format
  - `next-steps-panel.tsx` - Recommended next actions
  - `plan.tsx`, `plan-steps.tsx` - Action plan visualization
  - `confirmation.tsx`, `policy-change-confirmation.tsx` - User confirmation UI
  - `agent.tsx` - AI agent reasoning display
  - `chain-of-thought.tsx` - Multi-step reasoning visualization
  - `message.tsx` - Chat message display
  - `inline-citation.tsx` - Inline citation rendering
  - `file-tree.tsx` - File tree visualization
  - `queue.tsx` - Queue/task display
  - `reasoning.tsx` - Reasoning step display
  - `streaming-text.tsx` - Streaming response display
  - `action-buttons.tsx` - Action button groups
  - `code-block.tsx`, `snippet.tsx` - Code display components
  - `speech-input.tsx`, `mic-selector.tsx`, `voice-selector.tsx` - Voice input
  - `tool.tsx` - Tool invocation rendering
  - `loader.tsx`, `shimmer.tsx` - Loading states
  - `streamdown-styles.ts` - Markdown streaming styles
  - Plus additional specialized components
- **`chat/`** - Chat interface and context management
  - `chat-console.tsx` - Main chat interface with Sources UI, streaming indicators, org unit context, and tool output rendering
  - `chat-context.tsx` - Chat context provider (conversation state, message sending)
  - `org-units-list.tsx` - Organizational unit selection/display
  - `welcome-message.ts` - Dynamic welcome message generation based on fleet health
- **`cep/`** - CEP dashboard and app shell components
  - `app-shell.tsx` - App container/wrapper
  - `dashboard-overview.tsx` - Main dashboard layout with deterministic card colors
  - `dashboard-load-context.tsx` - Data loading context for dashboard
  - `dashboard-skeleton.tsx` - Loading skeleton UI
  - `mobile-dashboard-summary.tsx` - Mobile-optimized dashboard view
  - `user-status-bar.tsx` - User authentication display (session time, sign-out)
- **`fixtures/`** - Demo mode UI
  - `fixture-selector.tsx` - Fixture data selection UI
  - `demo-mode-banner.tsx` - Demo mode indicator banner
- **`ui/`** - Reusable UI primitives (shadcn/ui-based)
  - `org-unit-context.tsx` - React context for org unit name resolution (OrgUnitMapProvider, useOrgUnitMap)
  - `org-unit-display.tsx` - Inline component for rendering friendly org unit names from raw IDs
  - `dashboard-panel.tsx` - Dashboard-specific panel
  - `resizable-panels.tsx` - Resizable layout panels
  - `status-badge.tsx` - Status indicator badges
  - Standard primitives: `button.tsx`, `card.tsx`, `input.tsx`, `dialog.tsx`, `tabs.tsx`, `badge.tsx`, `tooltip.tsx`, `select.tsx`, `accordion.tsx`, `popover.tsx`, `dropdown-menu.tsx`, etc.

## Component Guidelines

### Direct Imports

Import components directly from their source files:

```typescript
// GOOD
import { Card } from "@/components/ui/card";
import { HypothesisCard } from "@/components/ai-elements/hypothesis-card";

// BAD - don't use barrel imports
import { Card, HypothesisCard } from "@/components";
```

### Org Unit Display

Use the `OrgUnitDisplay` component with `OrgUnitMapProvider` context to render friendly org unit names. Never display raw org unit IDs to users:

```typescript
import { OrgUnitDisplay } from "@/components/ui/org-unit-display";

// Renders "Engineering (/Sales/West Coast)" instead of "orgunits/03ph8a2z"
<OrgUnitDisplay id={rawOrgUnitId} />
```

### Accessibility

- Use semantic HTML elements (`button`, `nav`, etc.)
- Include ARIA attributes where needed
- Support keyboard navigation
- Provide meaningful alt text for images
- Add `cursor-pointer` to all interactive/clickable elements
- Ensure text wraps properly with `break-words` on long content

### State Management

- Keep state local when possible
- Use context for truly shared state (e.g., `OrgUnitMapContext`, `ChatContext`)
- Prefer composition over prop drilling

### Testing

Components with `.test.tsx` files should maintain their tests when modified. Focus tests on business logic and behavioral contracts rather than CSS class assertions.
