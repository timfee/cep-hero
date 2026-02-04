# Components Directory

See the root [AGENTS.md](../AGENTS.md) for project-wide coding standards.

## Directory Structure

- **`ui/`** - Radix UI primitives and design system components
- **`ai-elements/`** - AI chat and diagnostic UI components
- **`cep/`** - CEP dashboard and app shell components
- **`chat/`** - Chat interface and context management
- **`fixtures/`** - Fixture management UI

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

### Accessibility

- Use semantic HTML elements (`button`, `nav`, etc.)
- Include ARIA attributes where needed
- Support keyboard navigation
- Provide meaningful alt text for images

### State Management

- Keep state local when possible
- Use context for truly shared state
- Prefer composition over prop drilling

### Testing

Components with `.test.tsx` files should maintain their tests when modified.
