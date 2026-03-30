# Error Handling - Quick Reference Guide

## 🎯 Error Types Cheat Sheet

### Exception Hierarchy

```typescript
// Client Errors (4xx)
NotFoundException          // 404 - Resource not found
ForbiddenException         // 403 - Unauthorized access
BadRequestException        // 400 - Invalid input/data
ConflictException          // 409 - State conflict

// Custom Domain Errors
InvalidStateTransitionError // State machine violation
TerminalStateError          // Exiting terminal state
```

---

## 📋 Error Message Templates

### NotFoundException
```typescript
throw new NotFoundException(`Event ${eventId} not found`);
throw new NotFoundException('Booking not found');
throw new NotFoundException('Coupon not found');
```

**Pattern**: `[Entity] not found`

---

### ForbiddenException
```typescript
throw new ForbiddenException(
  'Only event organizer or admin can publish events'
);
throw new ForbiddenException(
  'Only the event organizer or admin can update this event'
);
```

**Pattern**: `Only [authorized role] can [action]`

---

### BadRequestException
```typescript
throw new BadRequestException(
  'Event must have valid start and end dates'
);
throw new BadRequestException(
  'End date must be after start date'
);
throw new BadRequestException(
  'Event capacity must be greater than 0'
);
throw new BadRequestException(
  'Cannot complete event before its end time'
);
```

**Pattern**: `[Validation rule] violated - [specific reason]`

---

### ConflictException
```typescript
throw new ConflictException(
  `Booking is already ${booking.status}`
);
throw new ConflictException(
  `Cannot confirm booking with status: ${booking.status}`
);
```

**Pattern**: `[Resource] is already [state]`

---

### InvalidStateTransitionError
```typescript
throw new InvalidStateTransitionError(
  EventStatus.DRAFT, 
  EventStatus.COMPLETED
);
// "Invalid state transition from DRAFT to COMPLETED. 
//  Valid transitions from DRAFT: PUBLISHED, CANCELLED"
```

**Pattern**: `Invalid state transition from [current] to [target]. Valid transitions: [list]`

---

## 🔍 Error Code Quick Lookup

| Error | When | Example |
|-------|------|---------|
| **NotFoundException** | Resource doesn't exist | Wrong ID, deleted resource |
| **ForbiddenException** | Wrong permissions | Regular user tries admin action |
| **BadRequestException** | Invalid input | Missing fields, bad format |
| **ConflictException** | State conflict | Already cancelled, double booking |
| **InvalidStateTransitionError** | State machine violation | DRAFT → COMPLETED |

---

## 🛠️ Error Handling Patterns

### Pattern 1: Try-Catch with Specific Errors

```typescript
try {
  await stateMachine.publishEvent(eventId, user);
} catch (error) {
  if (error instanceof NotFoundException) {
    // Handle not found
    return res.status(404).json({ error: 'Not found' });
  } else if (error instanceof ForbiddenException) {
    // Handle authorization
    return res.status(403).json({ error: 'Forbidden' });
  } else if (error instanceof BadRequestException) {
    // Handle validation
    return res.status(400).json({ error: error.message });
  } else {
    // Unexpected error
    logger.error('Unexpected error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

---

### Pattern 2: Error Recovery with Retry

```typescript
async publishWithRetry(
  eventId: string, 
  user: User,
  maxAttempts = 3
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await this.stateMachine.publishEvent(eventId, user);
      return; // Success
    } catch (error) {
      // Don't retry client errors
      if (error instanceof BadRequestException ||
          error instanceof ForbiddenException) {
        throw error;
      }
      
      // Retry on transient errors
      if (attempt === maxAttempts) {
        logger.error(`Failed after ${maxAttempts} attempts`);
        throw error;
      }
      
      // Exponential backoff
      await this.delay(Math.pow(2, attempt) * 1000);
    }
  }
}

private delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

### Pattern 3: Compensation on Failure

```typescript
async createBooking(dto: CreateBookingDto, userId: string) {
  // Step 1: Reserve seats
  const reservedSeats = await this.seatService.reserveSeats(
    dto.seatIds, userId, 15
  );
  
  try {
    // Step 2: Calculate pricing
    const pricing = await this.pricingService.calculatePrice(
      reservedSeats, userId, dto.promoCode
    );
    
    // Step 3: Save booking
    const booking = await this.saveBooking(pricing);
    
    return booking;
  } catch (error) {
    // Compensate: Release reserved seats
    await this.seatService.releaseSeats(dto.seatIds);
    logger.warn('Booking failed, seats released', { error });
    throw error;
  }
}
```

---

### Pattern 4: Graceful Degradation

```typescript
async getEventWithFallback(eventId: string) {
  try {
    // Try primary data source
    return await this.eventRepository.findOne({ 
      where: { id: eventId },
      relations: ['organizer']
    });
  } catch (error) {
    logger.warn('Primary lookup failed, using cache', error);
    
    // Fallback to cache
    const cached = await this.cache.get(`event:${eventId}`);
    if (cached) {
      return cached;
    }
    
    // Last resort: basic info only
    throw new NotFoundException('Event not found');
  }
}
```

---

## ✅ Validation Checklist Before Throwing

Before throwing an error, ensure:

- [ ] Error type matches the situation
- [ ] Message is clear and specific
- [ ] Includes relevant IDs/context
- [ ] Suggests solution if applicable
- [ ] Doesn't expose sensitive info
- [ ] Follows project conventions

---

## 🚫 Common Mistakes to Avoid

### ❌ Bad: Generic Error
```typescript
throw new Error('Something went wrong');
```

### ✅ Good: Specific Error
```typescript
throw new NotFoundException(`Event ${eventId} not found`);
```

---

### ❌ Bad: Vague Message
```typescript
throw new BadRequestException('Invalid data');
```

### ✅ Good: Clear Message
```typescript
throw new BadRequestException(
  'Event capacity must be greater than 0. Received: 0'
);
```

---

### ❌ Bad: Swallowing Errors
```typescript
try {
  await riskyOperation();
} catch (error) {
  // Silent failure
  console.log('Error occurred');
}
```

### ✅ Good: Proper Handling
```typescript
try {
  await riskyOperation();
} catch (error) {
  logger.error('Risky operation failed', { error, context });
  throw new ServiceUnavailableException('Temporarily unavailable');
}
```

---

## 🧪 Testing Errors

### Test Structure

```typescript
it('should throw NotFoundException when event not found', async () => {
  // Arrange
  jest.spyOn(repo, 'findOne').mockResolvedValue(null);
  
  // Act & Assert
  await expect(service.publishEvent('fake-id', user))
    .rejects.toThrow(NotFoundException);
  
  await expect(service.publishEvent('fake-id', user))
    .rejects.toThrow('Event fake-id not found');
});
```

---

### Property-Based Error Tests

```typescript
it('should handle all invalid states', async () => {
  await test(
    fc.asyncProperty(
      ArbitraryGenerators.event(),
      ArbitraryGenerators.organizerUser(),
      async (event, user) => {
        event.status = EventStatus.COMPLETED;
        event.organizerId = user.id;
        
        jest.spyOn(repo, 'findOne').mockResolvedValue(event);
        
        await expect(stateMachine.publishEvent(event.id, user))
          .rejects.toThrow(InvalidStateTransitionError);
      }
    ),
    { numRuns: 30 }
  );
});
```

---

## 📊 Error Response Format

### Standard API Error Response

```json
{
  "statusCode": 404,
  "timestamp": "2024-12-31T10:00:00.000Z",
  "path": "/events/abc-123/publish",
  "message": "Event abc-123 not found",
  "error": "Not Found"
}
```

### State Conflict Response

```json
{
  "statusCode": 409,
  "timestamp": "2024-12-31T10:00:00.000Z",
  "path": "/events/abc-123/publish",
  "message": "Invalid state transition from COMPLETED to PUBLISHED",
  "error": "Conflict",
  "details": {
    "currentState": "COMPLETED",
    "requestedState": "PUBLISHED",
    "validTransitions": []
  }
}
```

---

## 🆘 Debugging Tips

### 1. Check Error Stack Trace

```typescript
try {
  await operation();
} catch (error) {
  logger.error('Full error details:', {
    message: error.message,
    stack: error.stack,
    name: error.name,
  });
}
```

---

### 2. Add Context to Errors

```typescript
throw new BadRequestException(
  `Cannot complete event before end time`,
  {
    cause: 'Temporal validation failed',
    eventId: event.id,
    endTime: event.endTime.toISOString(),
    currentTime: new Date().toISOString(),
  }
);
```

---

### 3. Use Error Boundaries

```typescript
// Global error filter
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    
    logger.error('Unhandled exception', exception);
    
    response.status(500).json({
      statusCode: 500,
      message: 'Internal server error',
    });
  }
}
```

---

## 📚 Full Documentation

- **Comprehensive Tests**: `app/backend/test/error-path.coverage.spec.ts`
- **Task Summary**: `app/backend/TASK2_ERROR_PATH_SUMMARY.md`
- **State Machine Docs**: `app/backend/STATE_MACHINE_DOCUMENTATION.md`

---

Keep this guide handy when working with errors! 🚀
