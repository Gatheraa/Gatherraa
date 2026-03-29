# Event State Machine - Visual Guide

## 🎯 State Transition Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        EVENT STATE MACHINE                           │
└─────────────────────────────────────────────────────────────────────┘

                              ┌──────────┐
                              │   DRAFT  │ ◄── Initial State
                              │          │
                              └────┬─────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
              [Publish]                      [Cancel Draft]
                    │                             │
                    ▼                             ▼
           ┌──────────────┐              ┌─────────────┐
           │  PUBLISHED   │              │ CANCELLED   │ ◄── Terminal
           │              │              │             │     (No exit)
           └──────┬───────┘              └─────────────┘
                  │
         ┌────────┴────────┐
         │                 │
   [Complete]        [Cancel Event]
         │                 │
         ▼                 ▼
   ┌───────────┐      ┌─────────────┐
   │ COMPLETED │      │ CANCELLED   │ ◄── Terminal
   │           │      │             │     (No exit)
   └───────────┘      └─────────────┘
   Terminal
   (No exit)
```

---

## 📊 State Transition Matrix (Visual)

```
FROM \ TO       │  DRAFT  │  PUBLISHED  │  CANCELLED  │  COMPLETED
────────────────┼─────────┼─────────────┼─────────────┼────────────
DRAFT           │    -    │     ✅      │     ✅      │     ❌
PUBLISHED       │    ❌   │      -      │     ✅      │     ✅
CANCELLED       │    ❌   │     ❌      │      -      │     ❌
COMPLETED       │    ❌   │     ❌      │     ❌      │      -

Legend:
✅ = Valid transition
❌ = Invalid transition
-  = Same state (no transition)
```

---

## 🔄 Complete Lifecycle Examples

### Example 1: Successful Event (Happy Path)
```
Time: T0    Create Event
      │
      ▼
   [DRAFT] ─────────────┐
      │                 │ Organizer updates details,
      │                 │ adds dates, sets capacity
      ▼                 │
   [DRAFT] ─────────────┘
      │
      │ Organizer clicks "Publish"
      ▼
  [PUBLISHED] ───────────┐
      │                  │ Event is live, users can book
      │                  │ Tickets selling...
      ▼                  │
  [PUBLISHED] ───────────┘
      │
      │ Event date passes, event ends
      ▼
  [COMPLETED] ───────────┐
      │                  │ Reviews enabled,
      │                  │ certificates available
      ▼                  │
  [COMPLETED] ───────────┘ (Terminal State)
```

### Example 2: Cancelled Before Publishing
```
Time: T0    Create Event
      │
      ▼
   [DRAFT]
      │
      │ Organizer changes mind
      │ or scheduling conflict
      ▼
  [CANCELLED] ────────────┐
      │                  │ (Terminal State)
      ▼                  │
  [CANCELLED] ───────────┘
```

### Example 3: Cancelled After Publishing
```
Time: T0    Create Event
      │
      ▼
   [DRAFT]
      │
      │ Publish event
      ▼
  [PUBLISHED] ───────────┐
      │                  │ Event is live
      │                  │ Users have booked tickets
      │                  │ Speaker cancellation / Emergency
      ▼                  │
  [CANCELLED] ───────────┐
      │                  │ (Terminal State)
      │                  │ Refunds processed
      ▼                  │
  [CANCELLED] ───────────┘
```

---

## 🎭 State Characteristics Comparison

```
┌─────────────┬──────────┬────────────┬─────────────┬─────────────┐
│ Property    │  DRAFT   │ PUBLISHED  │ CANCELLED   │ COMPLETED   │
├─────────────┼──────────┼────────────┼─────────────┼─────────────┤
│ Visible?    │   ❌     │     ✅     │    ✅*      │     ✅*     │
│ Bookable?   │   ❌     │     ✅     │    ❌       │     ❌      │
│ Editable?   │   ✅     │    ⚠️      │    ❌       │     ❌      │
│ Terminal?   │   ❌     │     ❌     │    ✅       │     ✅      │
│ Refund?     │   N/A    │    ✅      │    ✅       │     ❌      │
└─────────────┴──────────┴────────────┴─────────────┴─────────────┘

* Visible to attendees/organizer only
⚠️ Limited editing allowed
```

---

## 🔐 Permission Matrix

```
Action                  │ Organizer │ Admin │ Regular User
────────────────────────┼───────────┼───────┼─────────────
Create (→ DRAFT)        │     ✅    │   ✅  │     ❌
Publish (DRAFT→PUB)    │     ✅    │   ✅  │     ❌
Cancel Draft            │     ✅    │   ✅  │     ❌
Cancel Published        │     ✅    │   ✅  │     ❌
Complete Event          │     ✅    │   ✅  │     ❌
View Draft              │     ✅    │   ✅  │     ❌
View Published          │     ✅    │   ✅  │     ✅
View Cancelled          │     ✅    │   ✅  │   (Attendees)
View Completed          │     ✅    │   ✅  │     ✅
```

---

## ⏰ Temporal Constraints

```
Timeline:
────────────────────────────────────────────────────────────────►
         Creation      Publish      Start      End      Complete
            │            │           │         │           │
            ▼            ▼           ▼         ▼           ▼
        [DRAFT] ────> [PUBLISHED] ──► [ACTIVE] ──► [COMPLETED]
                            │           │           │
                            │           │           │
                         Can cancel   Event is    Too late to
                         with refund  happening   cancel
                        
Constraints:
• Publish: endDate > startDate > now
• Complete: now > endDate
• Cancel: Before event starts (recommended)
```

---

## 🎯 Decision Tree for Transitions

```
Current State: DRAFT
├─ Want to make it live? → PUBLISH ✓
│  Requirements: Valid dates, capacity > 0
│
└─ Don't want event anymore? → CANCEL ✓
   Requirements: None

─────────────────────────────────────

Current State: PUBLISHED
├─ Event finished? → COMPLETE ✓
│  Requirements: endDate < now
│
├─ Need to cancel? → CANCEL ✓
│  Requirements: May need admin approval if bookings exist
│
└─ Want to edit details? → UPDATE (no state change) ✓
   Limitations: Cannot change to past dates

─────────────────────────────────────

Current State: CANCELLED or COMPLETED
└─ Any action? → ERROR ❌
   These are TERMINAL states - no exits!
```

---

## 📈 State Flow with Side Effects

```
[DRAFT]
   │
   │ [Publish]
   ├─► Validate dates ✓
   ├─► Check capacity ✓
   ├─► Set isPublic = true ✓
   ├─► Notify waitlist users 🔔
   ├─► Update search index 🔍
   └─► Trigger recommendations 🎯
   │
   ▼
[PUBLISHED]
   │
   │ [Cancel]
   ├─► Check permission ✓
   ├─► Mark as cancelled ✓
   ├─► Release reserved seats 🪑
   ├─► Process refunds 💰
   ├─► Notify attendees 📧
   └─► Update analytics 📊
   │
   ▼
[CANCELLED] (Terminal)

─────────────────────────

[PUBLISHED]
   │
   │ [Complete]
   ├─► Check endTime < now ✓
   ├─► Mark as completed ✓
   ├─► Enable reviews ⭐
   ├─► Generate certificates 📜
   ├─► Send review requests 📧
   └─► Update organizer stats 📈
   │
   ▼
[COMPLETED] (Terminal)
```

---

## 🚦 Validation Gates

```
Transition: DRAFT → PUBLISHED
┌────────────────────────────────┐
│ Gate 1: Is user organizer?     │──❌── Throw ForbiddenException
│                                │
│✅ Yes                          │
▼
│ Gate 2: Current state DRAFT?   │──❌── Throw InvalidStateTransitionError
│                                │
│✅ Yes                          │
▼
│ Gate 3: Has valid dates?       │──❌── Throw BadRequestException
│   start < end                  │
│                                │
│✅ Yes                          │
▼
│ Gate 4: Capacity > 0?          │──❌── Throw BadRequestException
│                                │
│✅ Yes                          │
▼
│ TRANSITION ALLOWED ✓           │
│ Event status = PUBLISHED       │
└────────────────────────────────┘

Transition: PUBLISHED → COMPLETED
┌────────────────────────────────┐
│ Gate 1: Is user organizer?     │──❌── Throw ForbiddenException
│                                │
│✅ Yes                          │
▼
│ Gate 2: Current state PUB?     │──❌── Throw InvalidStateTransitionError
│                                │
│✅ Yes                          │
▼
│ Gate 3: End time in past?      │──❌── Throw BadRequestException
│   endTime < now                │
│                                │
│✅ Yes                          │
▼
│ TRANSITION ALLOWED ✓           │
│ Event status = COMPLETED       │
└────────────────────────────────┘
```

---

## 🎪 Concurrent Access Handling

```
Scenario: Two organizers try to update same event

Time: T0
  Event Status: DRAFT
  
  Organizer A: Clicks "Publish" ──┐
                                  │
  Organizer B: Clicks "Cancel" ───┤
                                  │
  System: Optimistic Lock Check   │
                                  ▼
                          First request wins
                          Second gets:
                          "Optimistic lock failure"
                          
Result: Only one transition succeeds
        Event ends in either PUBLISHED or CANCELLED
        Not both!
```

---

## 📱 User Interface States

```
Organizer View:
┌─────────────────────────────────────────┐
│ Event Dashboard                         │
├─────────────────────────────────────────┤
│                                         │
│  [DRAFT]                                │
│  └─► Buttons: [Publish] [Cancel] [Edit]│
│                                         │
│  [PUBLISHED]                            │
│  └─► Buttons: [Complete] [Cancel] [Edit]│
│                                         │
│  [CANCELLED]                            │
│  └─► Label: "This event was cancelled" │
│                                         │
│  [COMPLETED]                            │
│  └─► Label: "This event has ended"     │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🎲 Edge Cases Handled

```
1. Rapid Fire Clicks
   User clicks "Publish" 5 times rapidly
   Result: Only first click works, others get error
   Solution: Optimistic locking + UI disable

2. Time Travel Paradox
   Try to complete event before it ends
   Result: BadRequestException
   Solution: Server-side time validation

3. Ghost Event
   Try to transition non-existent event
   Result: NotFoundException
   Solution: Existence check before transition

4. Zombie Event
   Try to revive cancelled/completed event
   Result: TerminalStateError
   Solution: Explicit terminal state checks

5. Imposter Event
   Unauthorized user tries to publish
   Result: ForbiddenException
   Solution: Role-based authorization
```

---

This visual guide complements the technical documentation and provides an easy-to-understand reference for working with the Event State Machine.
