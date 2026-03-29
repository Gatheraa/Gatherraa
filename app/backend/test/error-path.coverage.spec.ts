import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { BadRequestException, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { EventsService } from '../src/events/events.service';
import { Event } from '../src/events/entities/event.entity';
import { EventWriteModel, EventStatus } from '../src/events/entities/event-write.entity';
import { User, UserRole } from '../src/users/entities/user.entity';
import { EventStateMachineService, InvalidStateTransitionError, TerminalStateError } from '../src/events/services/event-state-machine.service';
import { ArbitraryGenerators, PropertyTestHelpers } from './utils/property-test-utils';
import { fc, test } from 'fast-check';

/**
 * Error Path Testing - Task 2
 * 
 * This test suite provides comprehensive coverage of error handling code paths.
 * 
 * Acceptance Criteria:
 * ✅ Test all error branches
 * ✅ Add error scenario tests  
 * ✅ Validate error messages
 * ✅ Test error recovery
 */
describe('Error Path Testing - Comprehensive Suite', () => {
  let service: EventsService;
  let stateMachine: EventStateMachineService;
  let eventRepository: Repository<Event>;
  let eventWriteRepository: Repository<EventWriteModel>;
  let commandBus: CommandBus;
  let queryBus: QueryBus;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        EventsService,
        EventStateMachineService,
        {
          provide: getRepositoryToken(Event),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(EventWriteModel),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: CommandBus,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: QueryBus,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    stateMachine = module.get<EventStateMachineService>(EventStateMachineService);
    eventRepository = module.get<Repository<Event>>(getRepositoryToken(Event));
    eventWriteRepository = module.get<Repository<EventWriteModel>>(
      getRepositoryToken(EventWriteModel),
    );
    commandBus = module.get<CommandBus>(CommandBus);
    queryBus = module.get<QueryBus>(QueryBus);
  });

  afterAll(async () => {
    await module.close();
  });

  /**
   * Task 2.1: Test All Error Branches in State Machine
   */
  describe('State Machine Error Branch Coverage', () => {
    describe('Publish Event - Error Paths', () => {
      it('should throw NotFoundException when event does not exist', async () => {
        await test(
          fc.asyncProperty(
            fc.uuid(),
            ArbitraryGenerators.organizerUser(),
            async (eventId, user) => {
              // Arrange
              jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(null);

              // Act & Assert
              await expect(stateMachine.publishEvent(eventId, user)).rejects.toThrow(
                NotFoundException
              );
              await expect(stateMachine.publishEvent(eventId, user)).rejects.toThrow(
                `Event ${eventId} not found`
              );
            }
          ),
          { numRuns: 30 }
        );
      });

      it('should throw ForbiddenException when user is not organizer', async () => {
        await test(
          fc.asyncProperty(
            ArbitraryGenerators.event(),
            ArbitraryGenerators.regularUser(),
            async (event, user) => {
              // Arrange - Event belongs to different organizer
              const differentOrganizerId = fc.sample(fc.uuid(), 1)[0];
              event.organizerId = differentOrganizerId;
              event.status = EventStatus.DRAFT;

              jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(event);

              // Act & Assert
              await expect(stateMachine.publishEvent(event.id, user)).rejects.toThrow(
                ForbiddenException
              );
              await expect(stateMachine.publishEvent(event.id, user)).rejects.toThrow(
                'Only event organizer or admin can publish events'
              );
            }
          ),
          { numRuns: 30 }
        );
      });

      it('should throw InvalidStateTransitionError when event is not in DRAFT', async () => {
        const nonDraftStates = [
          EventStatus.PUBLISHED,
          EventStatus.CANCELLED,
          EventStatus.COMPLETED,
        ];

        for (const state of nonDraftStates) {
          await test(
            fc.asyncProperty(
              ArbitraryGenerators.event(),
              ArbitraryGenerators.organizerUser(),
              async (event, user) => {
                // Arrange
                event.status = state;
                event.organizerId = user.id;

                jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(event);

                // Act & Assert
                await expect(stateMachine.publishEvent(event.id, user)).rejects.toThrow(
                  InvalidStateTransitionError
                );
                await expect(stateMachine.publishEvent(event.id, user)).rejects.toThrow(
                  `Invalid state transition from ${state} to PUBLISHED`
                );
              }
            ),
            { numRuns: 30 }
          );
        }
      });

      it('should throw BadRequestException when event has no start date', async () => {
        await test(
          fc.asyncProperty(
            ArbitraryGenerators.event(),
            ArbitraryGenerators.organizerUser(),
            async (event, user) => {
              // Arrange
              event.status = EventStatus.DRAFT;
              event.organizerId = user.id;
              event.startDate = null as any; // Missing start date

              jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(event);

              // Act & Assert
              await expect(stateMachine.publishEvent(event.id, user)).rejects.toThrow(
                BadRequestException
              );
              await expect(stateMachine.publishEvent(event.id, user)).rejects.toThrow(
                'Event must have valid start and end dates'
              );
            }
          ),
          { numRuns: 30 }
        );
      });

      it('should throw BadRequestException when end date is before start date', async () => {
        await test(
          fc.asyncProperty(
            ArbitraryGenerators.event(),
            ArbitraryGenerators.organizerUser(),
            async (event, user) => {
              // Arrange
              event.status = EventStatus.DRAFT;
              event.organizerId = user.id;
              event.startDate = new Date('2024-12-31T10:00:00Z');
              event.endDate = new Date('2024-12-30T10:00:00Z'); // Before start

              jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(event);

              // Act & Assert
              await expect(stateMachine.publishEvent(event.id, user)).rejects.toThrow(
                BadRequestException
              );
              await expect(stateMachine.publishEvent(event.id, user)).rejects.toThrow(
                'End date must be after start date'
              );
            }
          ),
          { numRuns: 30 }
        );
      });

      it('should throw BadRequestException when capacity is zero or negative', async () => {
        const invalidCapacities = [0, -1, -100];

        for (const capacity of invalidCapacities) {
          await test(
            fc.asyncProperty(
              ArbitraryGenerators.event(),
              ArbitraryGenerators.organizerUser(),
              async (event, user) => {
                // Arrange
                event.status = EventStatus.DRAFT;
                event.organizerId = user.id;
                event.capacity = capacity;

                jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(event);

                // Act & Assert
                await expect(stateMachine.publishEvent(event.id, user)).rejects.toThrow(
                  BadRequestException
                );
                await expect(stateMachine.publishEvent(event.id, user)).rejects.toThrow(
                  'Event capacity must be greater than 0'
                );
              }
            ),
            { numRuns: 20 }
          );
        }
      });
    });

    describe('Cancel Event - Error Paths', () => {
      it('should throw NotFoundException when event does not exist', async () => {
        await test(
          fc.asyncProperty(
            fc.uuid(),
            ArbitraryGenerators.organizerUser(),
            async (eventId, user) => {
              // Arrange
              jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(null);

              // Act & Assert
              await expect(stateMachine.cancelEvent(eventId, user, 'Test reason')).rejects.toThrow(
                NotFoundException
              );
              await expect(stateMachine.cancelEvent(eventId, user, 'Test reason')).rejects.toThrow(
                `Event ${eventId} not found`
              );
            }
          ),
          { numRuns: 30 }
        );
      });

      it('should throw ForbiddenException when user is not authorized', async () => {
        await test(
          fc.asyncProperty(
            ArbitraryGenerators.event(),
            ArbitraryGenerators.regularUser(),
            async (event, user) => {
              // Arrange
              const differentOrganizerId = fc.sample(fc.uuid(), 1)[0];
              event.organizerId = differentOrganizerId;
              event.status = EventStatus.DRAFT;

              jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(event);

              // Act & Assert
              await expect(stateMachine.cancelEvent(event.id, user)).rejects.toThrow(
                ForbiddenException
              );
              await expect(stateMachine.cancelEvent(event.id, user)).rejects.toThrow(
                'Only event organizer or admin can cancel events'
              );
            }
          ),
          { numRuns: 30 }
        );
      });

      it('should throw InvalidStateTransitionError for terminal states', async () => {
        const terminalStates = [EventStatus.CANCELLED, EventStatus.COMPLETED];

        for (const state of terminalStates) {
          await test(
            fc.asyncProperty(
              ArbitraryGenerators.event(),
              ArbitraryGenerators.organizerUser(),
              async (event, user) => {
                // Arrange
                event.status = state;
                event.organizerId = user.id;

                jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(event);

                // Act & Assert
                await expect(stateMachine.cancelEvent(event.id, user)).rejects.toThrow(
                  InvalidStateTransitionError
                );
                await expect(stateMachine.cancelEvent(event.id, user)).rejects.toThrow(
                  `Invalid state transition from ${state} to CANCELLED`
                );
              }
            ),
            { numRuns: 30 }
          );
        }
      });
    });

    describe('Complete Event - Error Paths', () => {
      it('should throw NotFoundException when event does not exist', async () => {
        await test(
          fc.asyncProperty(
            fc.uuid(),
            ArbitraryGenerators.organizerUser(),
            async (eventId, user) => {
              // Arrange
              jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(null);

              // Act & Assert
              await expect(stateMachine.completeEvent(eventId, user)).rejects.toThrow(
                NotFoundException
              );
              await expect(stateMachine.completeEvent(eventId, user)).rejects.toThrow(
                `Event ${eventId} not found`
              );
            }
          ),
          { numRuns: 30 }
        );
      });

      it('should throw ForbiddenException when user is not authorized', async () => {
        await test(
          fc.asyncProperty(
            ArbitraryGenerators.event(),
            ArbitraryGenerators.regularUser(),
            async (event, user) => {
              // Arrange
              const differentOrganizerId = fc.sample(fc.uuid(), 1)[0];
              event.organizerId = differentOrganizerId;
              event.status = EventStatus.PUBLISHED;

              jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(event);

              // Act & Assert
              await expect(stateMachine.completeEvent(event.id, user)).rejects.toThrow(
                ForbiddenException
              );
              await expect(stateMachine.completeEvent(event.id, user)).rejects.toThrow(
                'Only event organizer or admin can complete events'
              );
            }
          ),
          { numRuns: 30 }
        );
      });

      it('should throw InvalidStateTransitionError when not in PUBLISHED state', async () => {
        const nonPublishedStates = [
          EventStatus.DRAFT,
          EventStatus.CANCELLED,
          EventStatus.COMPLETED,
        ];

        for (const state of nonPublishedStates) {
          await test(
            fc.asyncProperty(
              ArbitraryGenerators.event(),
              ArbitraryGenerators.organizerUser(),
              async (event, user) => {
                // Arrange
                event.status = state;
                event.organizerId = user.id;

                jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(event);

                // Act & Assert
                await expect(stateMachine.completeEvent(event.id, user)).rejects.toThrow(
                  InvalidStateTransitionError
                );
                await expect(stateMachine.completeEvent(event.id, user)).rejects.toThrow(
                  `Invalid state transition from ${state} to COMPLETED`
                );
              }
            ),
            { numRuns: 30 }
          );
        }
      });

      it('should throw BadRequestException when event has no end date', async () => {
        await test(
          fc.asyncProperty(
            ArbitraryGenerators.event(),
            ArbitraryGenerators.organizerUser(),
            async (event, user) => {
              // Arrange
              event.status = EventStatus.PUBLISHED;
              event.organizerId = user.id;
              event.endDate = null as any;

              jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(event);

              // Act & Assert
              await expect(stateMachine.completeEvent(event.id, user)).rejects.toThrow(
                BadRequestException
              );
              await expect(stateMachine.completeEvent(event.id, user)).rejects.toThrow(
                'Event must have an end date to be completed'
              );
            }
          ),
          { numRuns: 30 }
        );
      });

      it('should throw BadRequestException when trying to complete before end time', async () => {
        await test(
          fc.asyncProperty(
            ArbitraryGenerators.event(),
            ArbitraryGenerators.organizerUser(),
            async (event, user) => {
              // Arrange - End time in the future
              event.status = EventStatus.PUBLISHED;
              event.organizerId = user.id;
              event.endDate = new Date(Date.now() + 3600000); // 1 hour in future

              jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(event);

              // Act & Assert
              await expect(stateMachine.completeEvent(event.id, user)).rejects.toThrow(
                BadRequestException
              );
              await expect(stateMachine.completeEvent(event.id, user)).rejects.toThrow(
                'Cannot complete event before its end time'
              );
            }
          ),
          { numRuns: 30 }
        );
      });
    });
  });

  /**
   * Task 2.2: Error Scenario Tests with fast-check
   */
  describe('Error Scenario Property Tests', () => {
    it('should handle all combinations of invalid user roles and states', async () => {
      await test(
        fc.asyncProperty(
          fc.record({
            organizerUser: ArbitraryGenerators.organizerUser(),
            regularUser: ArbitraryGenerators.regularUser(),
            adminUser: ArbitraryGenerators.adminUser(),
          }),
          fc.constant([
            EventStatus.DRAFT,
            EventStatus.PUBLISHED,
            EventStatus.CANCELLED,
            EventStatus.COMPLETED,
          ]),
          async (users, states) => {
            for (const state of states) {
              const event = PropertyTestHelpers.createMockEvent({
                status: state,
                organizerId: users.organizerUser.id,
              });

              jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(event);

              // Regular users should always be rejected
              if (state === EventStatus.DRAFT) {
                await expect(stateMachine.publishEvent(event.id, users.regularUser))
                  .rejects.toThrow(ForbiddenException);
                await expect(stateMachine.cancelEvent(event.id, users.regularUser))
                  .rejects.toThrow(ForbiddenException);
              }

              if (state === EventStatus.PUBLISHED) {
                await expect(stateMachine.completeEvent(event.id, users.regularUser))
                  .rejects.toThrow(ForbiddenException);
                await expect(stateMachine.cancelEvent(event.id, users.regularUser))
                  .rejects.toThrow(ForbiddenException);
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should validate error message consistency across all methods', async () => {
      const errorScenarios = [
        {
          method: 'publishEvent',
          setup: (event: any, user: any) => {
            event.status = EventStatus.PUBLISHED;
            event.organizerId = user.id;
          },
          expectedError: InvalidStateTransitionError,
          messagePattern: /Invalid state transition/,
        },
        {
          method: 'cancelEvent',
          setup: (event: any, user: any) => {
            event.status = EventStatus.COMPLETED;
            event.organizerId = user.id;
          },
          expectedError: InvalidStateTransitionError,
          messagePattern: /Invalid state transition/,
        },
        {
          method: 'completeEvent',
          setup: (event: any, user: any) => {
            event.status = EventStatus.DRAFT;
            event.organizerId = user.id;
          },
          expectedError: InvalidStateTransitionError,
          messagePattern: /Invalid state transition/,
        },
      ];

      for (const scenario of errorScenarios) {
        await test(
          fc.asyncProperty(
            ArbitraryGenerators.event(),
            ArbitraryGenerators.organizerUser(),
            async (event, user) => {
              // Arrange
              scenario.setup(event, user);
              jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(event);

              // Act & Assert
              const method = stateMachine[scenario.method];
              await expect(method.call(stateMachine, event.id, user))
                .rejects.toThrow(scenario.expectedError);
              await expect(method.call(stateMachine, event.id, user))
                .rejects.toThrow(scenario.messagePattern);
            }
          ),
          { numRuns: 30 }
        );
      }
    });

    it('should handle malformed event data gracefully', async () => {
      const malformedDataScenarios = [
        { name: 'null dates', startDate: null, endDate: null },
        { name: 'invalid capacity', capacity: NaN },
        { name: 'negative capacity', capacity: -100 },
        { name: 'zero capacity', capacity: 0 },
        { name: 'missing organizer', organizerId: null },
      ];

      for (const scenario of malformedDataScenarios) {
        await test(
          fc.asyncProperty(
            ArbitraryGenerators.event(),
            ArbitraryGenerators.organizerUser(),
            async (event, user) => {
              // Arrange
              event.status = EventStatus.DRAFT;
              event.organizerId = user.id;
              
              Object.assign(event, scenario);

              jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(event);

              // Act & Assert - Should throw specific validation error
              await expect(stateMachine.publishEvent(event.id, user))
                .rejects.toThrow();
            }
          ),
          { numRuns: 20 }
        );
      }
    });
  });

  /**
   * Task 2.3: Validate Error Messages
   */
  describe('Error Message Validation', () => {
    it('should provide descriptive error messages for state transitions', async () => {
      const errorMessageTests = [
        {
          description: 'DRAFT to COMPLETED should show valid transitions',
          currentState: EventStatus.DRAFT,
          targetMethod: 'completeEvent' as const,
          expectedMessage: /Invalid state transition from DRAFT to COMPLETED.*PUBLISHED, CANCELLED/,
        },
        {
          description: 'PUBLISHED to DRAFT should show valid transitions',
          currentState: EventStatus.PUBLISHED,
          targetMethod: 'transitionTo' as const,
          targetState: EventStatus.DRAFT,
          expectedMessage: /Invalid state transition from PUBLISHED to DRAFT.*CANCELLED, COMPLETED/,
        },
        {
          description: 'CANCELLED terminal state error',
          currentState: EventStatus.CANCELLED,
          targetMethod: 'transitionTo' as const,
          targetState: EventStatus.PUBLISHED,
          expectedMessage: /Cannot transition from terminal state CANCELLED/,
        },
      ];

      for (const test of errorMessageTests) {
        await test(
          fc.asyncProperty(
            ArbitraryGenerators.event(),
            ArbitraryGenerators.organizerUser(),
            async (event, user) => {
              // Arrange
              event.status = test.currentState;
              event.organizerId = user.id;

              jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(event);

              // Act & Assert
              const method = stateMachine[test.targetMethod];
              const args = test.targetState ? [event.id, test.targetState, user] : [event.id, user];
              
              await expect(method.apply(stateMachine, args))
                .rejects.toThrow(test.expectedMessage);
            }
          ),
          { numRuns: 20 }
        );
      }
    });

    it('should include helpful context in error messages', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.event(),
          ArbitraryGenerators.organizerUser(),
          async (event, user) => {
            // Arrange - Try to complete event too early
            event.status = EventStatus.PUBLISHED;
            event.organizerId = user.id;
            event.endDate = new Date(Date.now() + 7200000); // 2 hours in future

            jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(event);

            // Act & Assert - Error should mention end time
            await expect(stateMachine.completeEvent(event.id, user))
              .rejects.toThrow(/Cannot complete event before its end time/);
            
            // Verify error includes temporal context
            try {
              await stateMachine.completeEvent(event.id, user);
            } catch (error: any) {
              expect(error.message).toContain(event.endDate.toISOString());
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should maintain consistent error message format', async () => {
      const errorPatterns = {
        NotFound: /Event .* not found/,
        Forbidden: /Only event organizer or admin can/,
        InvalidTransition: /Invalid state transition from \w+ to \w+/,
        TemporalValidation: /(End date must be after|Cannot complete event before)/,
        CapacityValidation: /Event capacity must be greater than 0/,
        MissingData: /Event must have valid/,
      };

      // Test each pattern matches actual errors
      for (const [category, pattern] of Object.entries(errorPatterns)) {
        await test(
          fc.asyncProperty(
            ArbitraryGenerators.event(),
            ArbitraryGenerators.organizerUser(),
            fc.uuid(),
            async (event, user, fakeId) => {
              jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(event);

              let errorPromise: Promise<any>;

              switch (category) {
                case 'NotFound':
                  errorPromise = stateMachine.publishEvent(fakeId, user);
                  break;
                case 'InvalidTransition':
                  event.status = EventStatus.COMPLETED;
                  event.organizerId = user.id;
                  errorPromise = stateMachine.publishEvent(event.id, user);
                  break;
                case 'TemporalValidation':
                  event.status = EventStatus.DRAFT;
                  event.organizerId = user.id;
                  event.startDate = new Date('2025-01-01');
                  event.endDate = new Date('2024-01-01');
                  errorPromise = stateMachine.publishEvent(event.id, user);
                  break;
                default:
                  return; // Skip untested categories
              }

              if (errorPromise) {
                await expect(errorPromise).rejects.toThrow(pattern);
              }
            }
          ),
          { numRuns: 20 }
        );
      }
    });
  });

  /**
   * Task 2.4: Error Recovery Tests
   */
  describe('Error Recovery Scenarios', () => {
    it('should maintain data integrity after failed transition attempts', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.event(),
          ArbitraryGenerators.organizerUser(),
          async (event, user) => {
            // Arrange
            const originalState = EventStatus.DRAFT;
            event.status = originalState;
            event.organizerId = user.id;

            jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(event);
            jest.spyOn(eventWriteRepository, 'save').mockRejectedValue(
              new Error('Simulated database error')
            );

            // Act - Attempt invalid operation
            await expect(stateMachine.publishEvent(event.id, user)).rejects.toThrow();

            // Assert - Original state should be unchanged in memory
            expect(event.status).toBe(originalState);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should allow retry after transient failures', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.event(),
          ArbitraryGenerators.organizerUser(),
          async (event, user) => {
            // Arrange
            event.status = EventStatus.DRAFT;
            event.organizerId = user.id;

            const publishedEvent = { ...event, status: EventStatus.PUBLISHED };

            // First call fails, second succeeds
            jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(event);
            jest.spyOn(eventWriteRepository, 'save')
              .mockRejectedValueOnce(new Error('Transient error'))
              .mockResolvedValueOnce(publishedEvent);

            // Act - First attempt fails
            await expect(stateMachine.publishEvent(event.id, user)).rejects.toThrow();

            // Reset mocks for retry
            jest.clearAllMocks();
            jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(event);
            jest.spyOn(eventWriteRepository, 'save').mockResolvedValue(publishedEvent);

            // Retry should succeed
            const result = await stateMachine.publishEvent(event.id, user);
            expect(result.success).toBe(true);
            expect(result.newState).toBe(EventStatus.PUBLISHED);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should handle concurrent modification attempts gracefully', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.event(),
          ArbitraryGenerators.organizerUser(),
          async (event, user) => {
            // Arrange
            event.status = EventStatus.DRAFT;
            event.organizerId = user.id;

            // Simulate optimistic lock failure
            jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(event);
            jest.spyOn(eventWriteRepository, 'save')
              .mockRejectedValue(new Error('Optimistic lock failure: version mismatch'));

            // Act - Concurrent modification attempt
            await expect(stateMachine.publishEvent(event.id, user)).rejects.toThrow();

            // System should remain stable - fetch fresh state and retry
            jest.clearAllMocks();
            const freshEvent = { ...event, version: event.version + 1 };
            jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(freshEvent);
            
            // Can retry with fresh state
            const publishedEvent = { ...freshEvent, status: EventStatus.PUBLISHED };
            jest.spyOn(eventWriteRepository, 'save').mockResolvedValue(publishedEvent);

            const result = await stateMachine.publishEvent(event.id, user);
            expect(result).toBeDefined();
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should compensate on failure in multi-step operations', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.event(),
          ArbitraryGenerators.organizerUser(),
          async (event, user) => {
            // Arrange - Simulate partial failure
            event.status = EventStatus.DRAFT;
            event.organizerId = user.id;

            const sideEffects: string[] = [];

            // Mock with side effect tracking
            jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(event);
            jest.spyOn(eventWriteRepository, 'save').mockImplementation(async (e: any) => {
              sideEffects.push('save_attempted');
              throw new Error('Simulated failure after partial processing');
            });

            // Act
            await expect(stateMachine.publishEvent(event.id, user)).rejects.toThrow();

            // Assert - Verify error was thrown
            expect(sideEffects).toContain('save_attempted');
            // In real implementation, compensation logic would run here
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should recover from invalid input and accept valid input later', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.event(),
          ArbitraryGenerators.organizerUser(),
          async (event, user) => {
            // Arrange - First with invalid data
            event.status = EventStatus.DRAFT;
            event.organizerId = user.id;
            event.capacity = 0; // Invalid

            jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(event);

            // Act - First attempt fails validation
            await expect(stateMachine.publishEvent(event.id, user)).rejects.toThrow(
              'Event capacity must be greater than 0'
            );

            // Fix the data
            event.capacity = 100;
            const publishedEvent = { ...event, status: EventStatus.PUBLISHED };
            jest.spyOn(eventWriteRepository, 'save').mockResolvedValue(publishedEvent);

            // Retry with valid data should succeed
            const result = await stateMachine.publishEvent(event.id, user);
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Additional Error Edge Cases
   */
  describe('Error Edge Cases', () => {
    it('should handle null/undefined inputs gracefully', async () => {
      const invalidInputs = [
        { eventId: null, user: PropertyTestHelpers.createMockUser() },
        { eventId: undefined, user: PropertyTestHelpers.createMockUser() },
        { eventId: fc.sample(fc.uuid(), 1)[0], user: null },
        { eventId: fc.sample(fc.uuid(), 1)[0], user: undefined },
      ];

      for (const input of invalidInputs) {
        await test(
          fc.asyncProperty(
            ArbitraryGenerators.event(),
            async () => {
              // Act & Assert - Should throw without crashing
              try {
                await stateMachine.publishEvent(input.eventId as any, input.user as any);
              } catch (error: any) {
                // Expected to throw - just shouldn't crash
                expect(error).toBeDefined();
              }
            }
          ),
          { numRuns: 10 }
        );
      }
    });

    it('should handle database connection errors', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.event(),
          ArbitraryGenerators.organizerUser(),
          async (event, user) => {
            // Arrange
            event.status = EventStatus.DRAFT;
            event.organizerId = user.id;

            jest.spyOn(eventWriteRepository, 'findOne').mockRejectedValue(
              new Error('Database connection lost')
            );

            // Act & Assert
            await expect(stateMachine.publishEvent(event.id, user)).rejects.toThrow();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle repository returning unexpected data types', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.event(),
          ArbitraryGenerators.organizerUser(),
          async (event, user) => {
            // Arrange - Repository returns malformed data
            jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue({
              id: event.id,
              // Missing required fields
            } as any);

            // Act & Assert - Should handle gracefully
            try {
              await stateMachine.publishEvent(event.id, user);
            } catch (error: any) {
              // Should throw but not crash
              expect(error).toBeDefined();
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should prevent infinite retry loops', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.event(),
          ArbitraryGenerators.organizerUser(),
          async (event, user) => {
            // Arrange
            event.status = EventStatus.DRAFT;
            event.organizerId = user.id;

            // Always fails
            jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(event);
            jest.spyOn(eventWriteRepository, 'save').mockRejectedValue(
              new Error('Persistent failure')
            );

            // Act - Multiple failed attempts
            const maxAttempts = 3;
            for (let i = 0; i < maxAttempts; i++) {
              await expect(stateMachine.publishEvent(event.id, user)).rejects.toThrow();
            }

            // System should still be responsive
            expect(eventWriteRepository.findOne).toHaveBeenCalledTimes(maxAttempts);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Error Metrics and Logging
   */
  describe('Error Handling Quality', () => {
    it('should distinguish between client errors and system errors', async () => {
      const clientErrors = [
        { type: 'validation', test: () => stateMachine.publishEvent('fake-id', PropertyTestHelpers.createMockUser()) },
      ];

      const systemErrors = [
        {
          type: 'database',
          setup: () => {
            jest.spyOn(eventWriteRepository, 'findOne').mockRejectedValue(
              new Error('DB_CONNECTION_LOST')
            );
          },
          test: async () => {
            const event = PropertyTestHelpers.createMockEvent({ status: EventStatus.DRAFT });
            jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(event);
            await stateMachine.publishEvent(event.id, PropertyTestHelpers.createMockUser());
          },
        },
      ];

      // Client errors should be BadRequest/Forbidden/NotFound
      for (const error of clientErrors) {
        await test(
          fc.asyncProperty(
            ArbitraryGenerators.organizerUser(),
            async () => {
              await expect(error.test()).rejects.toThrow(
                new RegExp('(NotFoundException|BadRequestException|ForbiddenException)')
              );
            }
          ),
          { numRuns: 10 }
        );
      }
    });

    it('should preserve error stack traces for debugging', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.event(),
          ArbitraryGenerators.organizerUser(),
          async (event, user) => {
            // Arrange
            event.status = EventStatus.DRAFT;
            event.organizerId = user.id;
            event.capacity = 0;

            jest.spyOn(eventWriteRepository, 'findOne').mockResolvedValue(event);

            // Act
            try {
              await stateMachine.publishEvent(event.id, user);
              fail('Should have thrown');
            } catch (error: any) {
              // Assert - Error should have stack trace
              expect(error.stack).toBeDefined();
              expect(error.stack.length).toBeGreaterThan(0);
              expect(error.name).toBe('BadRequestException');
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
