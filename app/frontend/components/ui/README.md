# Gatherraa Design System

Shared component library with **atomic design** structure and **token-based theming**.

## Structure

- **Atoms** – Basic building blocks: `Button`, `Badge`, `Input`, `Text`
- **Molecules** – Composed components: `Card`, `FormField`, `StarRating`
- **Organisms** – Page-specific compositions live in `components/dao`, `components/wallet`, etc., and use atoms/molecules

## Theming (Design Tokens)

Tokens are defined in `app/globals.css` under `:root` and `@media (prefers-color-scheme: dark)`:

- **Surfaces**: `--background`, `--foreground`, `--surface`, `--surface-elevated`
- **Semantic colors**: `--color-primary`, `--color-success`, `--color-warning`, `--color-error`, `--color-info` (and `-muted` variants)
- **Typography**: `--font-sans`, `--font-mono`, `--text-primary`, `--text-secondary`, `--text-muted`
- **Spacing & radius**: `--radius-sm` through `--radius-full`, `--space-1` through `--space-12`
- **Focus**: `--focus-outline`, `--focus-outline-offset` for accessibility

Components use these via `var(--token-name)` in class names (e.g. `bg-[var(--color-primary)]`).

## Usage

```tsx
import { Button, Badge, Card, FormField, StarRating } from '@/components/ui';
```

## Storybook

- **Run**: `npm run storybook` (port 6006)
- **Build**: `npm run build-storybook`
- Stories live next to components (`*.stories.tsx`). The **Accessibility** addon (a11y) is enabled for compliance checks.

## Accessibility

- Focus visible styles use design tokens; `:focus-visible` is applied in `globals.css`.
- Components use semantic HTML and ARIA where needed (`role="status"` on Badge, `aria-label` support, `aria-invalid` on inputs, etc.).
- Run a11y checks in Storybook via the "Accessibility" tab.
