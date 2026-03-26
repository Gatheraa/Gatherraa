# SearchInput Component

A reusable search input component with built-in debounce logic, clear button, and loading states.

## Features

- ✅ **Debounced Input**: Configurable debounce delay to prevent excessive API calls
- ✅ **Clear Button**: Built-in clear button with customizable visibility
- ✅ **Loading State**: Visual feedback during search operations
- ✅ **Icon Support**: Customizable search and clear icons
- ✅ **Flexible Positioning**: Icons can be positioned left or right
- ✅ **Minimum Characters**: Configurable minimum character requirement
- ✅ **Enter Key Support**: Optional immediate search on Enter key
- ✅ **Accessibility**: Full keyboard navigation and screen reader support
- ✅ **Custom Styling**: Extensive className support for customization

## Props

```typescript
interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number;
  /** Callback fired when debounced value changes */
  onSearch?: (value: string) => void;
  /** Show clear button (default: true) */
  showClear?: boolean;
  /** Loading state (default: false) */
  loading?: boolean;
  /** Search icon position (default: 'left') */
  iconPosition?: 'left' | 'right';
  /** Custom search icon */
  searchIcon?: React.ReactNode;
  /** Custom clear icon */
  clearIcon?: React.ReactNode;
  /** Container className */
  containerClassName?: string;
  /** Minimum characters to trigger search (default: 0) */
  minChars?: number;
  /** Enable search on enter key (default: true) */
  searchOnEnter?: boolean;
}
```

## Usage Examples

### Basic Usage

```tsx
import { SearchInput } from '@/components/ui';

function SearchExample() {
  const handleSearch = (value: string) => {
    console.log('Searching for:', value);
  };

  return (
    <SearchInput
      placeholder="Search events..."
      onSearch={handleSearch}
    />
  );
}
```

### With Custom Debounce

```tsx
<SearchInput
  placeholder="Search..."
  debounceMs={500}
  onSearch={handleSearch}
/>
```

### With Loading State

```tsx
<SearchInput
  placeholder="Search..."
  loading={isLoading}
  onSearch={handleSearch}
/>
```

### Controlled Component

```tsx
function ControlledSearch() {
  const [value, setValue] = useState('');

  return (
    <SearchInput
      value={value}
      onSearch={(searchValue) => {
        setValue(searchValue);
        // Perform search
      }}
    />
  );
}
```

### With Minimum Characters

```tsx
<SearchInput
  placeholder="Search (min 3 chars)..."
  minChars={3}
  onSearch={handleSearch}
/>
```

### With Custom Icons

```tsx
<SearchInput
  placeholder="Search..."
  searchIcon={<CustomSearchIcon />}
  clearIcon={<CustomClearIcon />}
  onSearch={handleSearch}
/>
```

### Icon on Right

```tsx
<SearchInput
  placeholder="Search..."
  iconPosition="right"
  onSearch={handleSearch}
/>
```

## Styling

The component uses CSS custom properties for theming:

```css
.search-input {
  --surface: #ffffff;
  --surface-elevated: #f8f9fa;
  --text-primary: #1a1a1a;
  --text-muted: #6b7280;
  --text-secondary: #4b5563;
  --border-default: #e5e7eb;
  --color-primary: #3b82f6;
  --surface-hover: #f3f4f6;
}
```

## Accessibility

- Full keyboard navigation support
- Screen reader compatible with proper ARIA labels
- Focus management and visual indicators
- High contrast mode support

## Testing

The component includes comprehensive test coverage for:
- Basic rendering
- Debounce functionality
- Clear button behavior
- Loading states
- Keyboard interactions
- Accessibility features

To run tests:
```bash
npm test SearchInput
```

## Performance

- Optimized debounce implementation with cleanup
- Minimal re-renders using React hooks effectively
- Efficient event handling with proper cleanup
- Memory leak prevention with timeout cleanup
