import { Injectable, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventWriteModel, EventStatus } from '../entities/event-write.entity';
import { User, UserRole } from '../../users/entities/user.entity';

/**
 * Error classes for state machine transitions
 */
export class InvalidStateTransitionError extends ConflictException {
  constructor(currentState: EventStatus, targetState: EventStatus) {
    const validTransitions = InvalidStateTransitionError.getValidTransitions(currentState);
    super(
      `Invalid state transition from ${currentState} to ${targetState}. ` +
      `Valid transitions from ${currentState}: ${validTransitions.join(', ') || 'none'}`
    );
  }

  private static getValidTransitions(state: EventStatus): EventStatus[] {
    const validTransitions: Record<EventStatus, EventStatus[]> = {
      [EventStatus.DRAFT]: [EventStatus.PUBLISHED, EventStatus.CANCELLED],
      [EventStatus.PUBLISHED]: [EventStatus.CANCELLED, EventStatus.COMPLETED],
      [EventStatus.CANCELLED]: [],
      [EventStatus.COMPLETED]: [],
    };
    return validTransitions[state] || [];
  }
}

export class TerminalStateError extends ConflictException {
  constructor(state: EventStatus) {
    super(`Cannot transition from terminal state ${state}`);
  }
}

/**
 * State Transition Result
 */
export interface StateTransitionResult {
  success: boolean;
  event: EventWriteModel;
  previousState: EventStatus;
  newState: EventStatus;
  timestamp: Date;
}

/**
 * State Machine Service for Event Lifecycle Management
 * 
 * This service manages all state transitions for events, ensuring:
 * - Only valid transitions are allowed
 * - Business rules are enforced
 * - Invariants are maintained
 * - Proper authorization is checked
 */
@Injectable()
export class EventStateMachineService {
  constructor(
    @InjectRepository(EventWriteModel)
    private readonly eventRepository: Repository<EventWriteModel>,
  ) {}

  /**
   * Define valid state transitions
   */
  private readonly VALID_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
    [EventStatus.DRAFT]: [EventStatus.PUBLISHED, EventStatus.CANCELLED],
    [EventStatus.PUBLISHED]: [EventStatus.CANCELLED, EventStatus.COMPLETED],
    [EventStatus.CANCELLED]: [], // Terminal state
    [EventStatus.COMPLETED]: [], // Terminal state
  };

  /**
   * Check if a state transition is valid
   */
  isValidTransition(fromState: EventStatus, toState: EventStatus): boolean {
    return this.VALID_TRANSITIONS[fromState]?.includes(toState) || false;
  }

  /**
   * Check if a state is terminal
   */
  isTerminalState(state: EventStatus): boolean {
    return this.VALID_TRANSITIONS[state]?.length === 0;
  }

  /**
   * Get valid transitions from current state
   */
  getValidTransitions(fromState: EventStatus): EventStatus[] {
    return this.VALID_TRANSITIONS[fromState] || [];
  }

  /**
   * Publish a DRAFT event
   * 
   * Transitions: DRAFT -> PUBLISHED
   */
  async publishEvent(eventId: string, user: User): Promise<StateTransitionResult> {
    const event = await this.eventRepository.findOne({ where: { id: eventId } });

    if (!event) {
      throw new BadRequestException(`Event ${eventId} not found`);
    }

    // Authorization check
    if (event.organizerId !== user.id && !user.roles.includes(UserRole.ADMIN)) {
      throw new ForbiddenException('Only event organizer or admin can publish events');
    }

    // Guard: Check current state
    if (event.status !== EventStatus.DRAFT) {
      throw new InvalidStateTransitionError(event.status, EventStatus.PUBLISHED);
    }

    // Business rule validations
    if (!event.startDate || !event.endDate) {
      throw new BadRequestException('Event must have valid start and end dates');
    }

    if (event.endDate < event.startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    if (event.capacity <= 0) {
      throw new BadRequestException('Event capacity must be greater than 0');
    }

    // Perform transition
    const previousState = event.status;
    event.status = EventStatus.PUBLISHED;
    event.isPublic = true;
    event.updatedAt = new Date();

    const savedEvent = await this.eventRepository.save(event);

    return {
      success: true,
      event: savedEvent,
      previousState,
      newState: EventStatus.PUBLISHED,
      timestamp: new Date(),
    };
  }

  /**
   * Cancel an event
   * 
   * Transitions: DRAFT -> CANCELLED, PUBLISHED -> CANCELLED
   */
  async cancelEvent(eventId: string, user: User, reason?: string): Promise<StateTransitionResult> {
    const event = await this.eventRepository.findOne({ where: { id: eventId } });

    if (!event) {
      throw new BadRequestException(`Event ${eventId} not found`);
    }

    // Authorization check
    if (event.organizerId !== user.id && !user.roles.includes(UserRole.ADMIN)) {
      throw new ForbiddenException('Only event organizer or admin can cancel events');
    }

    // Guard: Check current state
    if (![EventStatus.DRAFT, EventStatus.PUBLISHED].includes(event.status)) {
      throw new InvalidStateTransitionError(event.status, EventStatus.CANCELLED);
    }

    // Additional checks for published events with bookings
    if (event.status === EventStatus.PUBLISHED) {
      // TODO: Check for existing bookings and apply refund policy
      // This could involve calling a booking service to release seats
    }

    // Perform transition
    const previousState = event.status;
    event.status = EventStatus.CANCELLED;
    event.metadata = {
      ...event.metadata,
      cancellationReason: reason,
      cancelledBy: user.id,
    };
    event.updatedAt = new Date();

    const savedEvent = await this.eventRepository.save(event);

    return {
      success: true,
      event: savedEvent,
      previousState,
      newState: EventStatus.CANCELLED,
      timestamp: new Date(),
    };
  }

  /**
   * Complete an event
   * 
   * Transitions: PUBLISHED -> COMPLETED
   */
  async completeEvent(eventId: string, user: User): Promise<StateTransitionResult> {
    const event = await this.eventRepository.findOne({ where: { id: eventId } });

    if (!event) {
      throw new BadRequestException(`Event ${eventId} not found`);
    }

    // Authorization check (admin or organizer)
    if (event.organizerId !== user.id && !user.roles.includes(UserRole.ADMIN)) {
      throw new ForbiddenException('Only event organizer or admin can complete events');
    }

    // Guard: Check current state
    if (event.status !== EventStatus.PUBLISHED) {
      throw new InvalidStateTransitionError(event.status, EventStatus.COMPLETED);
    }

    // Temporal invariant: Event must have ended
    const now = new Date();
    if (!event.endDate) {
      throw new BadRequestException('Event must have an end date to be completed');
    }

    if (event.endDate > now) {
      throw new BadRequestException(
        `Cannot complete event before its end time (${event.endDate.toISOString()}). Current time: ${now.toISOString()}`
      );
    }

    // Perform transition
    const previousState = event.status;
    event.status = EventStatus.COMPLETED;
    event.updatedAt = new Date();
    event.metadata = {
      ...event.metadata,
      completedAt: now.toISOString(),
    };

    const savedEvent = await this.eventRepository.save(event);

    return {
      success: true,
      event: savedEvent,
      previousState,
      newState: EventStatus.COMPLETED,
      timestamp: now,
    };
  }

  /**
   * Attempt a state transition (generic method)
   * 
   * This can be used for custom transitions or future state additions
   */
  async transitionTo(
    eventId: string,
    targetState: EventStatus,
    user: User,
    metadata?: Record<string, any>,
  ): Promise<StateTransitionResult> {
    const event = await this.eventRepository.findOne({ where: { id: eventId } });

    if (!event) {
      throw new BadRequestException(`Event ${eventId} not found`);
    }

    // Validate transition
    if (!this.isValidTransition(event.status, targetState)) {
      throw new InvalidStateTransitionError(event.status, targetState);
    }

    // Check if trying to exit terminal state
    if (this.isTerminalState(event.status)) {
      throw new TerminalStateError(event.status);
    }

    // Authorization based on target state
    await this.authorizeTransition(event, targetState, user);

    // Perform transition
    const previousState = event.status;
    event.status = targetState;
    event.updatedAt = new Date();

    if (metadata) {
      event.metadata = {
        ...event.metadata,
        ...metadata,
      };
    }

    const savedEvent = await this.eventRepository.save(event);

    return {
      success: true,
      event: savedEvent,
      previousState,
      newState: targetState,
      timestamp: new Date(),
    };
  }

  /**
   * Authorize state transition based on business rules
   */
  private async authorizeTransition(
    event: EventWriteModel,
    targetState: EventStatus,
    user: User,
  ): Promise<void> {
    // Most transitions require organizer or admin
    if (event.organizerId !== user.id && !user.roles.includes(UserRole.ADMIN)) {
      throw new ForbiddenException(
        `Unauthorized state transition. Only event organizer or admin can transition to ${targetState}`
      );
    }

    // Additional authorization logic can be added here based on state
    switch (targetState) {
      case EventStatus.PUBLISHED:
        // Already checked in publishEvent
        break;
      case EventStatus.CANCELLED:
        // Already checked in cancelEvent
        break;
      case EventStatus.COMPLETED:
        // Already checked in completeEvent
        break;
    }
  }

  /**
   * Validate state without transitioning
   */
  validateState(event: EventWriteModel): void {
    // Check state is valid enum value
    if (!Object.values(EventStatus).includes(event.status)) {
      throw new BadRequestException(`Invalid event status: ${event.status}`);
    }

    // Check temporal invariants
    if (event.status === EventStatus.COMPLETED && event.endDate) {
      if (event.endDate > new Date()) {
        throw new ConflictException(
          'Event marked as COMPLETED but end date is in the future'
        );
      }
    }

    // Check consistency
    if (event.status === EventStatus.PUBLISHED && !event.isPublic) {
      throw new ConflictException('Published event should be public');
    }
  }

  /**
   * Get state machine info for an event
   */
  getStateMachineInfo(event: EventWriteModel): {
    currentState: EventStatus;
    validTransitions: EventStatus[];
    isTerminal: boolean;
    stateHistory?: Array<{ state: EventStatus; timestamp: Date }>;
  } {
    return {
      currentState: event.status,
      validTransitions: this.getValidTransitions(event.status),
      isTerminal: this.isTerminalState(event.status),
      stateHistory: event.metadata?.stateHistory || [],
    };
  }
}
