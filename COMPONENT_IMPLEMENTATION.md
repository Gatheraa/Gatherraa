# Component Implementation: RegistrationGuard & OptimizedImage

This document describes the implementation of two new React components for the Gatherraa platform.

## 📋 Issues Addressed

- **Issue #302**: Event Registration Guard Component
- **Issue #306**: Lazy Image Component with Optimization

## 🎯 RegistrationGuard Component

### Purpose
A wrapper component that controls access to registration based on configurable conditions and rules.

### Features
✅ **Wallet Connection Validation** - Checks if user's wallet is connected  
✅ **Event Capacity Checking** - Prevents registration when event is full  
✅ **Registration Deadline Enforcement** - Blocks registration after deadline  
✅ **Custom Rule Support** - Allows custom validation logic  
✅ **Contextual Messages** - Displays appropriate error messages  
✅ **Reusable Design** - Works across different event pages  
✅ **Customizable UI** - Supports custom fallback components  

### Usage Example

```tsx
import { 
  RegistrationGuard, 
  createWalletRule, 
  createCapacityRule, 
  createExpirationRule 
} from '@/components/ui/molecules/RegistrationGuard';

const rules = [
  createWalletRule(isWalletConnected),
  createCapacityRule(currentRegistrations, maxCapacity),
  createExpirationRule(registrationDeadline),
];

<RegistrationGuard rules={rules}>
  <Button>Register Now</Button>
</RegistrationGuard>
```

### API Reference

#### RegistrationGuardProps
- `rules: RegistrationRule[]` - Array of validation rules
- `children: React.ReactNode` - Content to render when all rules pass
- `fallback?: React.ReactNode` - Custom fallback for failed validation
- `showRuleDetails?: boolean` - Show individual rule status
- `className?: string` - Additional CSS classes

#### Helper Functions
- `createWalletRule(isConnected: boolean)` - Wallet connection rule
- `createCapacityRule(current: number, max: number)` - Capacity rule
- `createExpirationRule(deadline: Date)` - Expiration rule
- `createCustomRule(check: Function, message: string)` - Custom rule

## 🖼️ OptimizedImage Component

### Purpose
An advanced image component with lazy loading, placeholder effects, and performance optimizations.

### Features
✅ **Lazy Loading** - Uses Intersection Observer for efficient loading  
✅ **Blur-up Effect** - Smooth placeholder to image transition  
✅ **Skeleton Loading** - Shows skeleton while loading  
✅ **Fallback Support** - Displays fallback image on error  
✅ **Layout Shift Prevention** - Maintains aspect ratios  
✅ **Responsive Design** - Multiple object-fit options  
✅ **Error Handling** - Graceful degradation on load failures  

### Usage Example

```tsx
import { OptimizedImage } from '@/components/ui/atoms/OptimizedImage';

<OptimizedImage
  src="https://example.com/image.jpg"
  alt="Description"
  aspectRatio="16/9"
  lazy={true}
  blurUp={true}
  placeholder="data:image/svg+xml;base64,..."
  fallbackSrc="/fallback.jpg"
  className="rounded-lg"
/>
```

### API Reference

#### OptimizedImageProps
- `src: string` - Image source URL
- `alt: string` - Alternative text
- `fallbackSrc?: string` - Fallback image URL
- `placeholder?: string` - Low-quality placeholder (LQIP)
- `showSkeleton?: boolean` - Show loading skeleton
- `lazy?: boolean` - Enable lazy loading
- `rootMargin?: string` - Intersection Observer root margin
- `threshold?: number` - Intersection Observer threshold
- `aspectRatio?: string` - Aspect ratio (e.g., "16/9", "1/1")
- `objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'`
- `blurUp?: boolean` - Enable blur-up effect
- `onLoad?: (event) => void` - Load success callback
- `onError?: (event) => void` - Load error callback

## 📁 File Structure

```
app/frontend/components/
├── ui/
│   ├── atoms/
│   │   ├── OptimizedImage/
│   │   │   ├── OptimizedImage.tsx
│   │   │   ├── OptimizedImage.stories.tsx
│   │   │   └── index.ts
│   │   └── index.ts (updated)
│   └── molecules/
│       ├── RegistrationGuard/
│       │   ├── RegistrationGuard.tsx
│       │   ├── RegistrationGuard.stories.tsx
│       │   └── index.ts
│       └── index.ts (updated)
└── Demo/
    └── RegistrationDemo.tsx
```

## 🎨 Design System Integration

Both components follow the existing design system patterns:

- **Consistent Styling** - Uses existing CSS variables and Tailwind classes
- **Component Architecture** - Follows atomic design principles
- **TypeScript Support** - Full type safety and IntelliSense
- **Accessibility** - Proper ARIA labels and semantic HTML
- **Responsive Design** - Mobile-first approach
- **Dark Mode** - Supports light/dark themes

## 📚 Storybook Stories

Comprehensive Storybook stories are included for both components:

### RegistrationGuard Stories
- All rules valid
- Wallet not connected
- Event full
- Registration expired
- Multiple issues
- Custom fallback
- Hide rule details

### OptimizedImage Stories
- Default image
- Aspect ratios
- Placeholder with blur-up
- Fallback image
- Lazy loading
- Object fit variants
- Custom skeleton
- Error handling

## 🧪 Testing Considerations

The components are designed with testability in mind:

- **Pure Functions** - Helper functions are easily testable
- **Mockable Dependencies** - External dependencies can be mocked
- **Event Callbacks** - Load/error events for testing
- **State Management** - Predictable state transitions
- **Accessibility** - Screen reader friendly markup

## 🚀 Performance Optimizations

### RegistrationGuard
- Minimal re-renders with stable rule references
- Efficient rule evaluation
- Conditional rendering for optimal performance

### OptimizedImage
- Intersection Observer for efficient lazy loading
- Image preloading with proper error handling
- Blur-up effect with CSS transitions
- Layout stability with aspect ratios
- Memory efficient with proper cleanup

## 🔧 Browser Support

- **Modern Browsers** - Chrome 88+, Firefox 85+, Safari 14+
- **Intersection Observer** - Supported in all modern browsers
- **CSS Features** - Uses widely supported CSS properties
- **TypeScript** - Full type support for better development experience

## 📝 Migration Guide

### Existing Registration Logic
Replace manual validation checks with RegistrationGuard:

```tsx
// Before
{isWalletConnected && !isEventFull && !isExpired ? (
  <RegisterButton />
) : (
  <ErrorMessage />
)}

// After
<RegistrationGuard rules={rules}>
  <RegisterButton />
</RegistrationGuard>
```

### Existing Image Components
Replace basic img tags with OptimizedImage:

```tsx
// Before
<img src={src} alt={alt} className="w-full h-full" />

// After
<OptimizedImage
  src={src}
  alt={alt}
  aspectRatio="16/9"
  lazy={true}
  className="w-full"
/>
```

## 🎯 Future Enhancements

### RegistrationGuard
- [ ] Integration with real wallet providers
- [ ] Advanced rule composition (AND/OR logic)
- [ ] Analytics tracking for registration attempts
- [ ] A/B testing support for different messages

### OptimizedImage
- [ ] WebP/AVIF format support with fallbacks
- [ ] Progressive image loading
- [ ] Image optimization service integration
- [ ] Zoom/lightbox functionality

## 🤝 Contributing

When contributing to these components:

1. Follow existing code patterns and naming conventions
2. Add comprehensive TypeScript types
3. Include Storybook stories for new features
4. Test accessibility with screen readers
5. Verify performance impact with React DevTools
6. Update documentation for API changes

---

**Implementation Date**: March 28, 2026  
**Issues Closed**: #302, #306  
**Pull Request**: feature/registration-guard-and-optimized-image
