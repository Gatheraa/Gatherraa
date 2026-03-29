# State Machine - Quick Reference Card

## 🎯 At a Glance

```
States: DRAFT → PUBLISHED → COMPLETED/CANCELLED
Terminal States: CANCELLED, COMPLETED (no exit!)
Initial State: DRAFT
```

---

## ✅ Valid Transitions Cheat Sheet

```typescript
// ✓ ALLOWED
DRAFT       → PUBLISHED   // Publish event
DRAFT       → CANCELLED   // Cancel before publishing
PUBLISHED   → CANCELLED   // Cancel live event
PUBLISHED   → COMPLETED   // Event ended successfully

// ✗ FORBIDDEN
DRAFT       → COMPLETED   // Must publish first!
PUBLISHED   → DRAFT       // Can't go backwards!
CANCELLED   → ANY         // Terminal state!
COMPLETED   → ANY         // Terminal state!
```

---

## 🔑 Key Methods

```typescript
// Inject service
constructor(
  private stateMachine: EventStateMachineService
) {}

// Publish
await stateMachine.publishEvent(eventId, user);

// Cancel
await stateMachine.cancelEvent(eventId, user, reason);

// Complete
await stateMachine.completeEvent(eventId, user);

// Check what's possible
const info = stateMachine.getStateMachineInfo(event);
// { currentState: 'draft', validTransitions: ['published', 'cancelled'] }
```

---

## ⚠️ Common Errors

```typescript
InvalidStateTransitionError
// "Invalid state transition from DRAFT to COMPLETED. 
//  Valid transitions from DRAFT: PUBLISHED, CANCELLED"

TerminalStateError
// "Cannot transition from terminal state COMPLETED"

ForbiddenException
// "Only event organizer or admin can publish events"

BadRequestException
// "Event must have valid start and end dates"
// "End date must be after start date"
// "Event capacity must be greater than 0"
```

---

## 🧪 Testing Quick Start

```typescript
import { EventStatus } from '../entities/event-write.entity';

// Test valid transition
it('should allow DRAFT → PUBLISHED', async () => {
  const draftEvent = createMockEvent({ status: EventStatus.DRAFT });
  const published = { ...draftEvent, status: EventStatus.PUBLISHED };
  
  const result = await repo.save(published);
  expect(result.status).toBe(EventStatus.PUBLISHED);
});

// Test invalid transition
it('should reject DRAFT → COMPLETED', async () => {
  const draftEvent = createMockEvent({ status: EventStatus.DRAFT });
  const completed = { ...draftEvent, status: EventStatus.COMPLETED };
  
  await expect(repo.save(completed)).rejects.toThrow();
});
```

---

## 📋 Validation Checklist

Before any transition:
- [ ] User is authenticated
- [ ] User has ORGANIZER or ADMIN role
- [ ] Event exists
- [ ] Current state allows target transition
- [ ] Not exiting terminal state
- [ ] All required data present
- [ ] Temporal constraints satisfied

---

## 🎭 State Characteristics

| State     | Editable | Visible | Bookable | Terminal |
|-----------|----------|---------|----------|----------|
| DRAFT     | ✅ Full  | ❌ No   | ❌ No    | ❌ No    |
| PUBLISHED | ⚠️ Limited | ✅ Yes | ✅ Yes   | ❌ No    |
| CANCELLED | ❌ No    | ✅ Org  | ❌ No    | ✅ Yes   |
| COMPLETED | ❌ No    | ✅ Yes  | ❌ No    | ✅ Yes   |

---

## 🔐 Permission Quick Ref

| Action          | Organizer | Admin | Regular User |
|-----------------|-----------|-------|--------------|
| Create          | ✅        | ✅    | ❌           |
| Publish         | ✅        | ✅    | ❌           |
| Cancel          | ✅        | ✅    | ❌           |
| Complete        | ✅        | ✅    | ❌           |
| View (any)      | ✅        | ✅    | ✅*          |

*Published/Completed only for regular users

---

## ⏰ Time-Based Rules

```
Publish:  endDate > startDate > now
Complete: now > endDate
Cancel:   Anytime before event starts (recommended)

Example:
Start: 2024-01-15 10:00
End:   2024-01-15 18:00

Can Publish:  Before 2024-01-15 10:00
Can Complete: After 2024-01-15 18:00
Can Cancel:   Before 2024-01-15 10:00 (best practice)
```

---

## 💡 Pro Tips

1. **Always check current state** before attempting transition
2. **Use the service methods** instead of direct entity updates
3. **Handle errors gracefully** with try-catch blocks
4. **Log transitions** for audit trail
5. **Notify affected users** on state changes
6. **Test edge cases** with property-based testing

---

## 📚 Full Documentation

- **Detailed Guide**: `STATE_MACHINE_DOCUMENTATION.md`
- **Visual Guide**: `STATE_MACHINE_VISUAL_GUIDE.md`
- **Implementation Summary**: `TASK1_STATE_TRANSITION_SUMMARY.md`
- **Test File**: `test/state-machine.transition.spec.ts`
- **Service**: `src/events/services/event-state-machine.service.ts`

---

## 🆘 Need Help?

Common issues and solutions:

**Problem**: "Invalid state transition" error  
**Solution**: Check current state with `getStateMachineInfo()`

**Problem**: Can't complete event  
**Solution**: Verify `endTime < now`

**Problem**: Can't cancel event  
**Solution**: Check if already in terminal state

**Problem**: Authorization error  
**Solution**: Ensure user has ORGANIZER or ADMIN role

---

Keep this card handy when working with event states! 🚀
