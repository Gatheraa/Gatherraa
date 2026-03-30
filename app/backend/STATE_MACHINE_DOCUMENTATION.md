# Event State Machine Documentation

## Overview

This document describes the Event State Machine implementation in the Gatherraa platform. The state machine governs how events transition through different states throughout their lifecycle.

## State Diagram

```
┌─────────┐
│  DRAFT  │
└────┬────┘
     │
     ├──────────────────┐
     │                  │
     ▼                  ▼
┌──────────┐      ┌─────────────┐
│ PUBLISHED│      │ CANCELLED   │ (Terminal)
└────┬─────┘      └─────────────┘
     │
     ├──────────────┐
     │              │
     ▼              ▼
┌──────────┐  ┌─────────────┐
│ COMPLETED│  │ CANCELLED   │ (Terminal)
└──────────┘  └─────────────┘
                (Terminal)
```

## States

### 1. DRAFT (Initial State)
- **Description**: Initial state when an event is created
- **Characteristics**:
  - Event is not visible to public users
  - Organizer can modify all event details
  - Cannot be booked by users
  - Default status for all new events
- **Allowed Transitions**:
  - → PUBLISHED (when organizer publishes the event)
  - → CANCELLED (if organizer cancels the draft)
- **Invalid Transitions**:
  - ✗ COMPLETED (cannot complete without publishing first)

### 2. PUBLISHED
- **Description**: Event is live and visible to users
- **Characteristics**:
  - Event is visible on the platform
  - Users can book tickets/seats
  - Organizer can still modify event details (with restrictions)
  - Appears in search results and recommendations
- **Allowed Transitions**:
  - → CANCELLED (if event needs to be cancelled)
  - → COMPLETED (after event end time has passed)
- **Invalid Transitions**:
  - ✗ DRAFT (cannot revert to draft once published)

### 3. CANCELLED (Terminal State)
- **Description**: Event has been cancelled and will not occur
- **Characteristics**:
  - Event is no longer bookable
  - Existing bookings may be refunded based on cancellation policy
  - Visible in user booking history with "Cancelled" status
  - Cannot transition to any other state
- **Entry Points**:
  - From DRAFT (organizer changes mind before publishing)
  - From PUBLISHED (event needs to be cancelled)
- **Exit Transitions**: None (Terminal State)

### 4. COMPLETED (Terminal State)
- **Description**: Event has successfully concluded
- **Characteristics**:
  - Event end time is in the past
  - No further bookings accepted
  - Reviews can be submitted
  - Attendees can download certificates (if applicable)
  - Cannot transition to any other state
- **Entry Points**:
  - From PUBLISHED (after event concludes)
- **Exit Transitions**: None (Terminal State)
- **Invariants**:
  - `endTime` must be defined and in the past
  - `startTime` must be less than or equal to `endTime`

## State Transition Matrix

| Current State | Target State | Allowed | Conditions | Method |
|---------------|--------------|---------|------------|--------|
| DRAFT         | PUBLISHED    | ✅ Yes  | Event has valid dates, capacity > 0 | `publishEvent()` |
| DRAFT         | CANCELLED    | ✅ Yes  | None | `cancelEvent()` |
| DRAFT         | COMPLETED    | ❌ No   | Must publish first | N/A |
| PUBLISHED     | DRAFT        | ❌ No   | Cannot revert | N/A |
| PUBLISHED     | CANCELLED    | ✅ Yes  | May require admin approval if bookings exist | `cancelEvent()` |
| PUBLISHED     | COMPLETED    | ✅ Yes  | endTime < now | `completeEvent()` |
| CANCELLED     | Any          | ❌ No   | Terminal state | N/A |
| COMPLETED     | Any          | ❌ No   | Terminal state | N/A |

## Implementation Details

### Entity Definition

```typescript
export enum EventStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

@Entity('events_write')
export class EventWriteModel {
  // ... other fields ...
  
  @Column({ type: 'varchar', length: 20 })
  @IsEnum(EventStatus)
  status: EventStatus;
  
  // ... other fields ...
}
```

### State Transition Guard Example

```typescript
async publishEvent(eventId: string, userId: string): Promise<Event> {
  const event = await this.eventRepository.findOne({ where: { id: eventId } });
  
  if (!event) {
    throw new NotFoundException('Event not found');
  }
  
  // Guard: Check current state
  if (event.status !== EventStatus.DRAFT) {
    throw new ConflictException(
      `Cannot publish event in ${event.status} state. Only DRAFT events can be published.`
    );
  }
  
  // Guard: Validate event data
  if (!event.startTime || !event.endTime) {
    throw new BadRequestException('Event must have valid start and end times');
  }
  
  if (event.capacity <= 0) {
    throw new BadRequestException('Event capacity must be greater than 0');
  }
  
  // Perform transition
  event.status = EventStatus.PUBLISHED;
  event.publishedAt = new Date();
  
  return await this.eventRepository.save(event);
}
```

### Invariant Checks

```typescript
// Temporal invariant for COMPLETED state
if (event.status === EventStatus.COMPLETED) {
  if (!event.endTime) {
    throw new Error('Completed event must have end time');
  }
  if (event.endTime > new Date()) {
    throw new Error('Cannot complete event before its end time');
  }
}

// Permission invariant
async cancelEvent(eventId: string, userId: string): Promise<Event> {
  const event = await this.eventRepository.findOne({ 
    where: { id: eventId },
    relations: ['organizer']
  });
  
  // Only organizer or admin can cancel
  if (event.organizerId !== userId && !user.roles.includes(UserRole.ADMIN)) {
    throw new ForbiddenException('Only event organizer or admin can cancel events');
  }
  
  // Cannot cancel already terminal events
  if ([EventStatus.CANCELLED, EventStatus.COMPLETED].includes(event.status)) {
    throw new ConflictException(`Cannot cancel event in ${event.status} state`);
  }
  
  event.status = EventStatus.CANCELLED;
  event.cancelledAt = new Date();
  
  return await this.eventRepository.save(event);
}
```

## Testing Strategy

### Property-Based Tests

The state machine is tested using property-based testing with fast-check:

1. **Valid Transition Tests**: Verify all allowed transitions work correctly
2. **Invalid Transition Tests**: Ensure forbidden transitions are rejected
3. **Invariant Tests**: Maintain data consistency across state changes
4. **Edge Case Tests**: Handle boundary conditions and concurrent updates

### Test Coverage

- ✅ All valid state transitions mapped and tested
- ✅ All invalid transitions explicitly rejected
- ✅ State invariants maintained across operations
- ✅ Terminal states properly enforced
- ✅ Permission checks for state changes
- ✅ Temporal constraints validated
- ✅ Concurrent state change handling

## Business Rules

### Publishing Rules
1. Event must be in DRAFT state
2. Event must have valid start and end times
3. End time must be after start time
4. Capacity must be greater than 0
5. Organizer must have ORGANIZER or ADMIN role

### Cancellation Rules
1. Only DRAFT or PUBLISHED events can be cancelled
2. Cancellation requires organizer or admin permission
3. If event has confirmed bookings, refund policy applies
4. Cancelled events notify all registered attendees

### Completion Rules
1. Only PUBLISHED events can be completed
2. Event end time must be in the past
3. Completion triggers review request notifications
4. Attendance certificates become available

## Hooks and Side Effects

### On Publish
- Send notification to waitlist users
- Update search index
- Trigger recommendation engine refresh
- Generate event QR code

### On Cancel
- Release reserved seats
- Process refunds based on cancellation policy
- Send cancellation notifications to attendees
- Update analytics dashboard

### On Complete
- Generate attendance reports
- Enable review submission
- Send certificate eligibility notifications
- Update organizer statistics

## Error Handling

### State Transition Errors

```typescript
export class InvalidStateTransitionError extends ConflictException {
  constructor(currentState: EventStatus, targetState: EventStatus) {
    super(
      `Invalid state transition from ${currentState} to ${targetState}`
    );
  }
}

export class TerminalStateError extends ConflictException {
  constructor(state: EventStatus) {
    super(
      `Cannot transition from terminal state ${state}`
    );
  }
}
```

### Validation Errors

```typescript
// Date validation
if (endTime <= startTime) {
  throw new BadRequestException('End time must be after start time');
}

// Capacity validation
if (capacity <= 0) {
  throw new BadRequestException('Capacity must be greater than 0');
}
```

## Monitoring and Observability

### Metrics to Track
- Number of events in each state
- Average time in each state
- Transition failure rates
- Most common invalid transitions

### Logging
```typescript
this.logger.log(
  `Event ${eventId} transitioned from ${oldState} to ${newState}`,
  { eventId, oldState, newState, userId }
);
```

### Alerts
- High rate of failed state transitions
- Events stuck in PUBLISHED state past end time
- Unauthorized state change attempts

## Related Files

- **Entity**: `app/backend/src/events/entities/event-write.entity.ts`
- **DTO**: `app/backend/src/events/dto/event.dto.ts`
- **Service**: `app/backend/src/events/events.service.ts`
- **Tests**: `app/backend/test/state-machine.transition.spec.ts`

## Future Enhancements

1. **UPCOMING State**: Add explicit UPCOMING state for published events that haven't started
2. **PAUSED State**: Allow temporary pause of ticket sales
3. **State History**: Track complete state transition history
4. **Automatic Transitions**: Auto-complete events after end time + grace period
5. **State Machine Visualization**: Interactive diagram showing current state distribution

## References

- [Finite State Machine Pattern](https://en.wikipedia.org/wiki/Finite-state_machine)
- [State Pattern](https://refactoring.guru/design-patterns/state)
- Fast-check Property Testing: `app/backend/test/utils/property-test-utils.ts`
