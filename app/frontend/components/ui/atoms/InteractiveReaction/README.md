# InteractiveReaction Component

A reusable reaction component for likes, comments, shares, and other interactive feedback mechanisms with smooth animations and engaging micro-interactions.

## Features

- **6 Reaction Types**: like, love, thumbsup, comment, share, bookmark
- **Smooth Animations**: Each reaction type has unique, non-blocking animations
- **Heart Beat**: Like and love reactions feature a heart beat animation
- **Bounce Effects**: Thumbs-up includes a satisfying bounce animation
- **Smooth Counter Updates**: Animated number transitions with easing
- **Accessibility**: Full keyboard navigation and screen reader support
- **Responsive Design**: Works across all screen sizes
- **Customizable**: Multiple sizes and styling options

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `reactionType` | `ReactionType` | Required | Type of reaction ('like' \| 'love' \| 'thumbsup' \| 'comment' \| 'share' \| 'bookmark') |
| `count` | `number` | Required | Number of current reactions |
| `onReact` | `(type: ReactionType, isActive: boolean) => void` | Optional | Callback when reaction is toggled |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Component size |
| `showCount` | `boolean` | `true` | Whether to display the count |
| `disabled` | `boolean` | `false` | Disable interaction |
| `className` | `string` | `''` | Additional CSS classes |
| `isActive` | `boolean` | `false` | Initial active state |

## Usage Examples

### Basic Usage
```tsx
import { InteractiveReaction } from '@/components/ui';

<InteractiveReaction
  reactionType="like"
  count={42}
  onReact={(type, isActive) => console.log(`${type} ${isActive ? 'liked' : 'unliked'}`)}
/>
```

### All Reaction Types
```tsx
<div className="flex gap-2">
  <InteractiveReaction reactionType="like" count={42} />
  <InteractiveReaction reactionType="love" count={128} />
  <InteractiveReaction reactionType="thumbsup" count={256} />
  <InteractiveReaction reactionType="comment" count={15} />
  <InteractiveReaction reactionType="share" count={8} />
  <InteractiveReaction reactionType="bookmark" count={64} />
</div>
```

### Custom Styling
```tsx
<InteractiveReaction
  reactionType="like"
  count={42}
  size="lg"
  className="border-2 border-red-200"
  onReact={handleReaction}
/>
```

### Without Count
```tsx
<InteractiveReaction
  reactionType="bookmark"
  count={0}
  showCount={false}
  onReact={handleBookmark}
/>
```

## Animations

Each reaction type has a unique animation:

- **Like/Love**: Heart beat animation (scale 1 → 1.3 → 1 → 1.3 → 1)
- **Thumbs Up**: Bounce animation with vertical movement
- **Comment**: Pulse animation with opacity changes
- **Share**: Spin animation with scale effects
- **Bookmark**: Rotation animation with tilt effects

## Performance

- Uses CSS transforms for smooth 60fps animations
- Non-blocking animations that don't affect UI thread
- Efficient counter updates with requestAnimationFrame
- Proper cleanup of animation timeouts

## Accessibility

- Full keyboard navigation support
- Screen reader announcements for count changes
- Focus management and visible focus states
- Semantic button element with proper ARIA attributes

## Integration

The component is fully integrated into the Gatherraa design system and follows the established patterns:

- Uses design system colors and spacing
- Follows atomic design principles
- Compatible with existing UI components
- TypeScript support with proper type definitions
