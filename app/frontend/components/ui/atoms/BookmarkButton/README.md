# BookmarkButton Component

A toggle button component for save/unsave events with persistent storage support and comprehensive UI feedback.

## Features

- ✅ **Toggle State**: Visual feedback for bookmarked/unbookmarked states
- ✅ **Persistent Storage**: Optional localStorage integration for state persistence
- ✅ **UI Feedback**: Loading states, animations, and visual indicators
- ✅ **Custom Icons**: Support for custom bookmarked/unbookmarked icons
- ✅ **Count Badge**: Optional count display with smart formatting (99+)
- ✅ **Multiple Sizes**: Small, medium, and large variants
- ✅ **Style Variants**: Primary, secondary, and ghost styles
- ✅ **Accessibility**: Full ARIA support and keyboard navigation
- ✅ **Tooltips**: Customizable tooltips for different states
- ✅ **Async Support**: Handles async save/unsave operations with loading states

## Props

```typescript
interface BookmarkButtonProps {
  /** Current bookmarked state */
  isBookmarked?: boolean;
  /** Callback when bookmark state changes */
  onBookmarkChange?: (bookmarked: boolean) => void;
  /** Callback when save action occurs */
  onSave?: () => void | Promise<void>;
  /** Callback when unsave action occurs */
  onUnsave?: () => void | Promise<void>;
  /** Loading state */
  loading?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Button size: 'sm' | 'md' | 'lg' (default: 'md') */
  size?: 'sm' | 'md' | 'lg';
  /** Button variant: 'primary' | 'secondary' | 'ghost' (default: 'secondary') */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Show count badge (default: false) */
  showCount?: boolean;
  /** Bookmark count (default: 0) */
  count?: number;
  /** Custom bookmarked icon */
  bookmarkedIcon?: React.ReactNode;
  /** Custom unbookmarked icon */
  unbookmarkedIcon?: React.ReactNode;
  /** Custom class names */
  className?: string;
  /** Tooltip text when bookmarked */
  bookmarkedTooltip?: string;
  /** Tooltip text when not bookmarked */
  unbookmarkedTooltip?: string;
  /** Auto-save to localStorage (default: false) */
  persistent?: boolean;
  /** Storage key for persistence */
  storageKey?: string;
}
```

## Usage Examples

### Basic Usage

```tsx
import { BookmarkButton } from '@/components/ui';

function BookmarkExample() {
  const [isBookmarked, setIsBookmarked] = useState(false);

  const handleBookmarkChange = (bookmarked: boolean) => {
    setIsBookmarked(bookmarked);
  };

  return (
    <BookmarkButton
      isBookmarked={isBookmarked}
      onBookmarkChange={handleBookmarkChange}
    />
  );
}
```

### With Save/Unsave Handlers

```tsx
function BookmarkExample() {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await saveToServer();
      setIsBookmarked(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsave = async () => {
    setIsLoading(true);
    try {
      await unsaveFromServer();
      setIsBookmarked(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <BookmarkButton
      isBookmarked={isBookmarked}
      loading={isLoading}
      onSave={handleSave}
      onUnsave={handleUnsave}
    />
  );
}
```

### With Persistent Storage

```tsx
function PersistentBookmarkExample() {
  return (
    <BookmarkButton
      persistent={true}
      storageKey="user-bookmark-123"
      onBookmarkChange={(bookmarked) => {
        console.log('Bookmark state:', bookmarked);
      }}
    />
  );
}
```

### With Count Badge

```tsx
function BookmarkWithCount() {
  const [bookmarkCount, setBookmarkCount] = useState(42);

  return (
    <BookmarkButton
      showCount={true}
      count={bookmarkCount}
      onBookmarkChange={(bookmarked) => {
        setBookmarkCount(prev => bookmarked ? prev + 1 : prev - 1);
      }}
    />
  );
}
```

### Custom Styling

```tsx
function CustomBookmarkExample() {
  return (
    <BookmarkButton
      variant="primary"
      size="lg"
      bookmarkedIcon={<span>⭐</span>}
      unbookmarkedIcon={<span>☆</span>}
      bookmarkedTooltip="Remove from favorites"
      unbookmarkedTooltip="Add to favorites"
      onBookmarkChange={(bookmarked) => {
        console.log('Bookmarked:', bookmarked);
      }}
    />
  );
}
```

## Styling

The component uses CSS custom properties for theming:

```css
.bookmark-button {
  --surface: #ffffff;
  --surface-hover: #f3f4f6;
  --surface-elevated: #f8f9fa;
  --text-primary: #1a1a1a;
  --text-secondary: #6b7280;
  --border-default: #e5e7eb;
  --color-primary: #3b82f6;
  --color-primary-hover: #2563eb;
  --color-error: #ef4444;
}
```

## Accessibility

- **ARIA Support**: `aria-pressed`, `aria-label`, and `title` attributes
- **Keyboard Navigation**: Full keyboard accessibility with Enter/Space activation
- **Screen Reader**: Visually hidden status indicators for screen readers
- **Focus Management**: Visible focus indicators and logical tab order
- **High Contrast**: Supports high contrast mode and reduced motion

## Performance

- **Optimized Re-renders**: Uses React hooks efficiently to prevent unnecessary updates
- **Memory Management**: Proper cleanup of timeouts and event listeners
- **Debounced Actions**: Prevents rapid successive clicks
- **Lazy Loading**: Icons and components load only when needed

## Browser Support

- **Modern Browsers**: Full support for Chrome, Firefox, Safari, Edge
- **localStorage**: Fallback gracefully when storage is unavailable
- **Async/Await**: Supports modern async/await patterns
- **ES6+**: Requires modern JavaScript environment

## Testing

The component includes comprehensive test coverage for:
- Toggle functionality
- Persistent storage behavior
- Loading and disabled states
- Accessibility features
- Custom icon support
- Count badge display

## Integration Examples

### With Redux/Zustand

```tsx
import { useStore } from '@/store';

function ConnectedBookmark() {
  const { bookmarks, addBookmark, removeBookmark } = useStore();
  const isBookmarked = bookmarks.includes('item-123');

  return (
    <BookmarkButton
      isBookmarked={isBookmarked}
      onSave={() => addBookmark('item-123')}
      onUnsave={() => removeBookmark('item-123')}
    />
  );
}
```

### With API Integration

```tsx
function ApiBookmarkButton({ itemId }: { itemId: string }) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check initial bookmark status
    checkBookmarkStatus(itemId).then(setIsBookmarked);
  }, [itemId]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await bookmarkItem(itemId);
      setIsBookmarked(true);
    } catch (error) {
      console.error('Failed to bookmark:', error);
    }
    setLoading(false);
  };

  const handleUnsave = async () => {
    setLoading(true);
    try {
      await unbookmarkItem(itemId);
      setIsBookmarked(false);
    } catch (error) {
      console.error('Failed to unbookmark:', error);
    }
    setLoading(false);
  };

  return (
    <BookmarkButton
      isBookmarked={isBookmarked}
      loading={loading}
      onSave={handleSave}
      onUnsave={handleUnsave}
    />
  );
}
```
