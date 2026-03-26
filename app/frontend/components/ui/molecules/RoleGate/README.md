# RoleGate Component

A wrapper component for role-based UI rendering with flexible access control and comprehensive permission management.

## Features

- ✅ **Role-Based Access**: Control component visibility based on user roles
- ✅ **Permission Support**: Fine-grained permission checking
- ✅ **Flexible Modes**: Support for ANY or ALL role matching
- ✅ **Custom Logic**: Extensible role checking functions
- ✅ **Context Integration**: Built-in React context for easy access
- ✅ **Render Props**: Support for render prop pattern
- ✅ **Fallback UI**: Customizable unauthorized state
- ✅ **Loading States**: Visual feedback during permission checks
- ✅ **Caching**: Performance optimization with result caching
- ✅ **Accessibility**: Full ARIA support and keyboard navigation
- ✅ **HOC Support**: Higher-order component for easy integration

## Props

```typescript
interface RoleGateProps {
  /** Array of allowed roles */
  allowedRoles: string[];
  /** Array of required permissions (optional) */
  requiredPermissions?: string[];
  /** Current user roles */
  userRoles?: string[];
  /** Current user permissions */
  userPermissions?: string[];
  /** Fallback component to show when unauthorized */
  fallback?: React.ReactNode;
  /** Loading component to show while checking */
  loadingComponent?: React.ReactNode;
  /** Custom unauthorized message */
  unauthorizedMessage?: string;
  /** Custom unauthorized description */
  unauthorizedDescription?: string;
  /** Show role information in unauthorized state */
  showRoleInfo?: boolean;
  /** Enable strict mode (all roles must match) */
  strictMode?: boolean;
  /** Custom role checking function */
  roleChecker?: (userRoles: string[], allowedRoles: string[]) => boolean;
  /** Render prop pattern */
  children: React.ReactNode | ((hasAccess: boolean) => React.ReactNode);
  /** Custom class names */
  className?: string;
  /** Log access attempts */
  logAccess?: boolean;
  /** Cache role check results */
  cacheResults?: boolean;
}
```

## Usage Examples

### Basic Role-Based Access

```tsx
import { RoleGate, ROLES } from '@/components/ui';

function AdminPanel() {
  return (
    <RoleGate
      allowedRoles={[ROLES.ADMIN]}
      userRoles={[ROLES.USER]} // This would be from auth context
    >
      <div>Admin-only content</div>
    </RoleGate>
  );
}
```

### With Permissions

```tsx
import { RoleGate, ROLES, PERMISSIONS } from '@/components/ui';

function ContentManager() {
  return (
    <RoleGate
      allowedRoles={[ROLES.CONTENT_CREATOR, ROLES.ADMIN]}
      requiredPermissions={[PERMISSIONS.MANAGE_CONTENT]}
      userRoles={[ROLES.CONTENT_CREATOR]}
      userPermissions={[PERMISSIONS.MANAGE_CONTENT]}
    >
      <div>Content management interface</div>
    </RoleGate>
  );
}
```

### Using Context Provider

```tsx
import { RoleGateProvider, RoleGate, useRoleGate } from '@/components/ui';

function App({ children, user }) {
  return (
    <RoleGateProvider userRoles={user.roles} userPermissions={user.permissions}>
      {children}
    </RoleGateProvider>
  );
}

function SomeComponent() {
  const { hasAccess } = useRoleGate();
  
  return (
    <RoleGate allowedRoles={[ROLES.USER]}>
      {hasAccess ? <div>Content</div> : <div>No access</div>}
    </RoleGate>
  );
}
```

### Render Prop Pattern

```tsx
function ConditionalComponent() {
  return (
    <RoleGate allowedRoles={[ROLES.USER]} userRoles={[ROLES.USER]}>
      {(hasAccess) => (
        <div>
          <p>Access Status: {hasAccess ? 'Granted' : 'Denied'}</p>
          {hasAccess && <div>Protected content here</div>}
        </div>
      )}
    </RoleGate>
  );
}
```

### Strict Mode

```tsx
// User must have ALL specified roles
function SuperAdminPanel() {
  return (
    <RoleGate
      allowedRoles={[ROLES.ADMIN, ROLES.SUPER_ADMIN]}
      strictMode={true}
      userRoles={[ROLES.ADMIN]} // No access - missing SUPER_ADMIN
    >
      <div>Super admin content</div>
    </RoleGate>
  );
}
```

### Custom Role Checker

```tsx
function CustomAccessComponent() {
  const customRoleChecker = (userRoles, allowedRoles) => {
    // Custom logic: allow access based on business rules
    return userRoles.some(role => allowedRoles.includes(role)) && 
           new Date().getHours() >= 9 && new Date().getHours() <= 17; // Business hours
  };

  return (
    <RoleGate
      allowedRoles={[ROLES.PREMIUM_USER]}
      roleChecker={customRoleChecker}
      userRoles={[ROLES.PREMIUM_USER]}
    >
      <div>Premium business hours content</div>
    </RoleGate>
  );
}
```

### With Fallback UI

```tsx
function ProtectedComponent() {
  const customFallback = (
    <div className="text-center p-8">
      <h3>Upgrade Required</h3>
      <p>This feature requires a premium subscription.</p>
      <button onClick={() => window.location.href = '/pricing'}>
        Upgrade Now
      </button>
    </div>
  );

  return (
    <RoleGate
      allowedRoles={[ROLES.PREMIUM_USER]}
      fallback={customFallback}
      userRoles={[ROLES.USER]}
    >
      <div>Premium content</div>
    </RoleGate>
  );
}
```

### Higher-Order Component

```tsx
import { withRoleGate, ROLES } from '@/components/ui';

const ProtectedComponent = withRoleGate([ROLES.ADMIN])(
  function AdminComponent({ children, ...props }) {
    return (
      <div className="admin-panel">
        {children}
      </div>
    );
  }
);

// Usage
<ProtectedComponent userRoles={[ROLES.ADMIN]}>
  <AdminDashboard />
</ProtectedComponent>
```

## Predefined Constants

```typescript
// Roles
ROLES = {
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  USER: 'user',
  PREMIUM_USER: 'premium_user',
  CONTENT_CREATOR: 'content_creator',
  EVENT_ORGANIZER: 'event_organizer',
  TICKET_SCANNER: 'ticket_scanner',
  ANALYST: 'analyst',
}

// Permissions
PERMISSIONS = {
  READ: 'read',
  WRITE: 'write',
  DELETE: 'delete',
  MANAGE_USERS: 'manage_users',
  MANAGE_CONTENT: 'manage_content',
  MANAGE_EVENTS: 'manage_events',
  VIEW_ANALYTICS: 'view_analytics',
  SCAN_TICKETS: 'scan_tickets',
  APPROVE_CONTENT: 'approve_content',
}
```

## Utility Functions

```typescript
// Role checking utilities
hasRole(userRoles, role)           // Check if user has specific role
hasAnyRole(userRoles, roles)       // Check if user has any of the roles
hasAllRoles(userRoles, roles)       // Check if user has all specified roles
hasPermission(userPermissions, permission)  // Check if user has specific permission
hasAnyPermission(userPermissions, permissions)  // Check if user has any of the permissions
```

## Styling

The component uses CSS custom properties for theming:

```css
.role-gate-unauthorized {
  --surface: #ffffff;
  --surface-hover: #f3f4f6;
  --text-primary: #1a1a1a;
  --text-secondary: #6b7280;
  --text-muted: #9ca3af;
  --border-default: #e5e7eb;
  --color-primary: #3b82f6;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
}
```

## Accessibility

- **ARIA Support**: `aria-pressed`, `aria-label`, and semantic markup
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Reader**: Proper announcements for state changes
- **Focus Management**: Logical focus flow and visible indicators
- **High Contrast**: Support for high contrast themes

## Performance

- **Caching**: Optional result caching to avoid repeated checks
- **Memoization**: Optimized re-renders with React hooks
- **Lazy Loading**: Components load only when needed
- **Efficient Updates**: Minimal re-renders with proper dependencies

## Integration Examples

### With Authentication

```tsx
// In your auth provider
import { RoleGateProvider } from '@/components/ui';

function AuthProvider({ children, user }) {
  return (
    <RoleGateProvider 
      userRoles={user.roles} 
      userPermissions={user.permissions}
    >
      {children}
    </RoleGateProvider>
  );
}
```

### With Redux/Zustand

```tsx
import { useAuthStore } from '@/store';

function ProtectedComponent() {
  const { user } = useAuthStore();
  
  return (
    <RoleGate
      allowedRoles={[ROLES.ADMIN]}
      userRoles={user.roles}
      userPermissions={user.permissions}
    >
      <AdminContent />
    </RoleGate>
  );
}
```

### Complex Permission Matrix

```tsx
function ComplexAccessControl() {
  return (
    <RoleGate
      allowedRoles={[ROLES.ADMIN, ROLES.MODERATOR, ROLES.CONTENT_CREATOR]}
      requiredPermissions={[PERMISSIONS.MANAGE_CONTENT]}
      userRoles={user.roles}
      userPermissions={user.permissions}
      fallback={<UpgradePrompt />}
      showRoleInfo={true}
    >
      <ContentManagement />
    </RoleGate>
  );
}
```

## Testing

The component includes comprehensive test coverage for:
- Role-based access control
- Permission checking
- Fallback UI rendering
- Context provider functionality
- Custom role checker integration
- Loading and error states

## Best Practices

1. **Use Context**: Wrap your app with `RoleGateProvider` for clean access
2. **Be Specific**: Use the most specific roles/permissions needed
3. **Provide Feedback**: Always show meaningful unauthorized states
4. **Cache Results**: Enable caching for frequently checked permissions
5. **Test Thoroughly**: Test all role combinations and edge cases

## Migration from v1

If you're upgrading from a previous version:
- Replace `hasRole` prop with `allowedRoles` array
- Update permission checking to use `requiredPermissions`
- Migrate custom fallback UI to use the new fallback prop
- Update context usage to use the new context provider
