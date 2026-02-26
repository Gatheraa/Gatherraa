# Gatherraa Design System

Shared component library with atomic-design structure and token-based theming.

## Structure

- Atoms: `Button`, `Badge`, `Input`, `Skeleton`, `Spinner`, `Text`
- Molecules: `Card`, `FormField`, `LoadingSkeletons`, `StarRating`
- Organisms: page-specific compositions live in `components/dao`, `components/wallet`, and feature folders

## Theming (Design Tokens)

Tokens are defined in `app/globals.css` under `:root` and `@media (prefers-color-scheme: dark)`:

- Surfaces: `--background`, `--foreground`, `--surface`, `--surface-elevated`
- Semantic colors: `--color-primary`, `--color-success`, `--color-warning`, `--color-error`, `--color-info` and muted variants
- Typography: `--font-sans`, `--font-mono`, `--text-primary`, `--text-secondary`, `--text-muted`
- Spacing and radius: `--radius-sm` through `--radius-full`, `--space-1` through `--space-12`
- Focus: `--focus-outline`, `--focus-outline-offset`

Components consume tokens through `var(--token-name)` in class names (for example, `bg-[var(--color-primary)]`).

## Usage

```tsx
import { Button, Card, FormField, SkeletonCard, SkeletonTable, Spinner } from '@/components/ui';
```

## Storybook

- Run: `npm run storybook` (port `6006`)
- Build: `npm run build-storybook`
- Stories live beside components (`*.stories.tsx`) with accessibility checks enabled

## Accessibility

- Focus-visible styles are tokenized in `globals.css`
- Components use semantic HTML and ARIA where needed (`role="status"`, `aria-label`, `aria-invalid`, etc.)
