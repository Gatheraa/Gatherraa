# FAQ Accordion Component

A reusable, accessible FAQ accordion component for help pages and course guides.

## Features

- ✅ **Expand/Collapse Items** - Smooth animated transitions when toggling items
- ✅ **Keyboard Accessible** - Full keyboard navigation with ARIA attributes
- ✅ **Multiple Open Items** - Optional support for keeping multiple items open simultaneously
- ✅ **Responsive Design** - Works seamlessly on all screen sizes
- ✅ **TypeScript Support** - Fully typed for better DX
- ✅ **Customizable** - Supports callbacks, custom classNames, and default open states
- ✅ **Markdown Content** - Supports formatted text, lists, links, and code blocks

## Installation

The component is already included in the common components directory.

## Usage

### Basic Example

```tsx
import { FAQAccordion } from '@/components/common/FAQAccordion';

const faqs = [
  {
    id: 'faq-1',
    question: 'What is this?',
    answer: 'This is an FAQ item.',
  },
  {
    id: 'faq-2',
    question: 'How does it work?',
    answer: 'It expands and collapses when clicked.',
  },
];

export default function HelpPage() {
  return <FAQAccordion items={faqs} />;
}
```

### With Multiple Open Items

```tsx
<FAQAccordion
  items={faqs}
  allowMultipleOpen={true}
  defaultOpenIds={['faq-1']}
/>
```

### With Callback

```tsx
<FAQAccordion
  items={faqs}
  allowMultipleOpen={true}
  onItemToggle={(id, isOpen) => {
    console.log(`Item ${id} is now ${isOpen ? 'open' : 'closed'}`);
  }}
/>
```

## Props

### `items` (required)

Array of FAQ items to display.

```ts
interface FAQItem {
  id: string;        // Unique identifier
  question: string;  // Question text
  answer: string;    // Answer text (supports HTML)
}
```

### `allowMultipleOpen` (optional)

Enable multiple items to be open at the same time. Default: `false`

```tsx
<FAQAccordion items={faqs} allowMultipleOpen={true} />
```

### `defaultOpenIds` (optional)

Array of item IDs that should be open by default.

```tsx
<FAQAccordion items={faqs} defaultOpenIds={['faq-1', 'faq-2']} />
```

### `onItemToggle` (optional)

Callback fired when an item is toggled. Receives the item ID and open state.

```tsx
<FAQAccordion
  items={faqs}
  onItemToggle={(id, isOpen) => {
    console.log(`Item ${id} is ${isOpen ? 'open' : 'closed'}`);
  }}
/>
```

### `className` (optional)

Additional CSS class names to apply to the root element.

```tsx
<FAQAccordion items={faqs} className="my-custom-class" />
```

## Keyboard Navigation

The accordion supports full keyboard navigation:

| Key | Action |
|-----|--------|
| **Enter** or **Space** | Toggle current item |
| **Arrow Down** | Focus next item |
| **Arrow Up** | Focus previous item |
| **Home** | Focus first item |
| **End** | Focus last item |

## Accessibility

The component includes:

- ✅ ARIA attributes (`aria-expanded`, `aria-controls`, `aria-labelledby`)
- ✅ Semantic HTML (`role="region"`)
- ✅ Full keyboard navigation support
- ✅ Focus management and visual indicators
- ✅ Respects `prefers-reduced-motion` preference
- ✅ Proper heading hierarchy support

## Styling

The component uses CSS-in-JS with styled JSX and supports the following CSS variables:

```css
--accent: #c8f04e;           /* Primary color for accents */
--text-primary: #f0ede8;     /* Main text color */
--text-muted: #888;          /* Secondary text color */
--border-color: rgba(...);   /* Border color */
--interactive-bg: rgba(...); /* Background for open items */
```

You can override these variables:

```tsx
<div style={{
  '--accent': '#ff0000',
  '--text-primary': '#ffffff',
} as React.CSSProperties}>
  <FAQAccordion items={faqs} />
</div>
```

## Animation

Items animate with a smooth cubic-bezier timing function. The animation respects the user's motion preference (via `prefers-reduced-motion` media query).

## Examples by Use Case

### Help Pages

```tsx
import { FAQAccordion } from '@/components/common/FAQAccordion';

const helpItems = [
  {
    id: 'help-password',
    question: 'How do I reset my password?',
    answer: 'Click "Forgot Password" and follow the email instructions...',
  },
  // More help items...
];

export default function HelpPage() {
  return (
    <div>
      <h1>Help & Support</h1>
      <FAQAccordion items={helpItems} />
    </div>
  );
}
```

### Course Guides

```tsx
import { FAQAccordion } from '@/components/common/FAQAccordion';

const courseModules = [
  {
    id: 'module-1',
    question: 'Module 1: Introduction',
    answer: 'Learn the basics...Duration: 2 hours',
  },
  // More modules...
];

export default function CourseGuide() {
  return (
    <FAQAccordion
      items={courseModules}
      allowMultipleOpen={true}
      defaultOpenIds={['module-1']}
    />
  );
}
```

### Rich Content (with HTML)

```tsx
const richFaqs = [
  {
    id: 'faq-1',
    question: 'How do I create an event?',
    answer: `
      <ol>
        <li>Connect your wallet</li>
        <li>Click "Create Event"</li>
        <li>Fill in the details</li>
        <li>Submit and publish</li>
      </ol>
      <p>For more help, <a href="/docs">view our documentation</a></p>
    `,
  },
];
```

## Testing

The component is designed with testability in mind:

- `data-faq-id` attributes for querying items
- `aria-expanded` for testing open/closed state
- Semantic HTML elements for easier testing

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FAQAccordion } from './FAQAccordion';

it('toggles item on click', async () => {
  const items = [
    { id: '1', question: 'Q1', answer: 'A1' },
  ];
  
  render(<FAQAccordion items={items} />);
  const button = screen.getByRole('button', { name: 'Q1' });
  
  expect(button).toHaveAttribute('aria-expanded', 'false');
  await userEvent.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'true');
});
```

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Supports modern browsers with CSS Grid, Flexbox, and ES6+ features

## Performance

- Smooth animations using CSS transitions
- Content height calculations are memoized
- Refs are properly cleaned up to prevent memory leaks
- Efficient re-rendering with proper React hooks usage

## Troubleshooting

### Items not showing/hiding

Make sure the `items` array has unique `id` values and proper `question`/`answer` fields.

### Animations not working

Check if the class names are properly applied and CSS-in-JS is loading. Ensure no conflicting global styles override the transitions.

### Keyboard navigation not working

Verify that the component is focused and that `onKeyDown` event handlers are not being prevented elsewhere in the component hierarchy.

## Contributing

When modifying the component:

1. Update tests for any new functionality
2. Keep the component accessible (ARIA, keyboard navigation)
3. Maintain smooth animations
4. Test on multiple browsers
5. Update the stories for Storybook
