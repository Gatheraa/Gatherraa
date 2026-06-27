# Authentication

This application uses a global JWT Auth Guard. This means that by default, all endpoints require a valid JWT token to be accessed.

## The `@Public()` Decorator

If you have an endpoint that should be accessible without authentication (e.g., login, registration, or public data endpoints), you must explicitly opt-out of the global authentication by using the `@Public()` decorator.

### Usage Example

```typescript
import { Controller, Get } from '@nestjs/common';
import { Public } from '../src/auth/decorators/public.decorator';

@Controller('items')
export class ItemsController {
  
  // This route is public and does not require a JWT
  @Public()
  @Get('public')
  getPublicItems() {
    return 'This route is public';
  }

  // This route is protected by default and requires a valid JWT
  @Get('protected')
  getProtectedItems() {
    return 'This route is protected';
  }
}
```

The `JwtAuthGuard` checks the metadata set by `@Public()` using the NestJS `Reflector` and will bypass the authentication checks if the metadata is present.
