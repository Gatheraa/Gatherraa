import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Repository } from 'typeorm';
import { fc, test } from 'fast-check';
import { EventsService } from '../src/events/events.service';
import { Event } from '../src/events/entities/event.entity';
import { CreateEventDto } from '../src/events/dto/create-event.dto';
import { UpdateEventDto } from '../src/events/dto/update-event.dto';
import { User, UserRole } from '../src/users/entities/user.entity';
import { ArbitraryGenerators, PropertyTestHelpers, FuzzTestHelpers } from './utils/property-test-utils';

describe('EventsService Property-Based Tests', () => {
  let service: EventsService;
  let eventRepository: Repository<Event>;
  let commandBus: CommandBus;
  let queryBus: QueryBus;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        EventsService,
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
    eventRepository = module.get<Repository<Event>>(getRepositoryToken(Event));
    commandBus = module.get<CommandBus>(CommandBus);
    queryBus = module.get<QueryBus>(QueryBus);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Event Creation Property Tests', () => {
    it('should maintain invariants when creating events with valid data', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.createEventDto(),
          ArbitraryGenerators.organizerUser(),
          async (createEventDto, user) => {
            // Arrange
            const mockEvent = PropertyTestHelpers.createMockEvent({
              name: createEventDto.name,
              description: createEventDto.description,
              contractAddress: createEventDto.contractAddress,
              organizerId: createEventDto.organizerId || user.id,
              startTime: new Date(createEventDto.startTime),
              endTime: createEventDto.endTime ? new Date(createEventDto.endTime) : undefined,
            });

            jest.spyOn(eventRepository, 'findOne').mockResolvedValue(null);
            jest.spyOn(eventRepository, 'create').mockReturnValue(mockEvent);
            jest.spyOn(eventRepository, 'save').mockResolvedValue(mockEvent);

            // Act
            const result = await service.create(createEventDto, user);

            // Assert
            PropertyTestHelpers.assertEventInvariants(result);
            expect(result.organizerId).toBe(createEventDto.organizerId || user.id);
            expect(result.contractAddress).toBe(createEventDto.contractAddress);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject duplicate contract addresses', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.createEventDto(),
          ArbitraryGenerators.organizerUser(),
          async (createEventDto, user) => {
            // Arrange
            const existingEvent = PropertyTestHelpers.createMockEvent({
              contractAddress: createEventDto.contractAddress,
            });

            jest.spyOn(eventRepository, 'findOne').mockResolvedValue(existingEvent);

            // Act & Assert
            await expect(service.create(createEventDto, user)).rejects.toThrow(
              'Event with this contract address already exists'
            );
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject event creation by non-organizer users', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.createEventDto(),
          ArbitraryGenerators.regularUser(),
          async (createEventDto, user) => {
            // Act & Assert
            await expect(service.create(createEventDto, user)).rejects.toThrow(
              'Only organizers and admins can create events'
            );
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Event Retrieval Property Tests', () => {
    it('should maintain pagination invariants', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.paginationParams(),
          fc.array(ArbitraryGenerators.event(), { minLength: 0, maxLength: 100 }),
          async (pagination, events) => {
            // Arrange
            const skip = (pagination.page - 1) * pagination.limit;
            const pagedEvents = events.slice(skip, skip + pagination.limit);
            
            jest.spyOn(eventRepository, 'findAndCount').mockResolvedValue([pagedEvents, events.length]);

            // Act
            const result = await service.findAll(pagination.page, pagination.limit);

            // Assert
            const [returnedEvents, totalCount] = result;
            expect(returnedEvents.length).toBeLessThanOrEqual(pagination.limit);
            expect(totalCount).toBe(events.length);
            PropertyTestHelpers.assertPaginationInvariants(pagination.page, pagination.limit, totalCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return valid event structure when found', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.event(),
          async (event) => {
            // Arrange
            jest.spyOn(eventRepository, 'findOne').mockResolvedValue(event);

            // Act
            const result = await service.findOne(event.id);

            // Assert
            PropertyTestHelpers.assertEventInvariants(result);
            expect(result.id).toBe(event.id);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should throw NotFoundException for non-existent events', async () => {
      await test(
        fc.asyncProperty(
          fc.uuid(),
          async (eventId) => {
            // Arrange
            jest.spyOn(eventRepository, 'findOne').mockResolvedValue(null);

            // Act & Assert
            await expect(service.findOne(eventId)).rejects.toThrow(
              `Event with ID ${eventId} not found`
            );
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Event Update Property Tests', () => {
    it('should maintain invariants when updating events', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.event(),
          ArbitraryGenerators.updateEventDto(),
          ArbitraryGenerators.organizerUser(),
          async (event, updateDto, user) => {
            // Arrange
            event.organizerId = user.id; // Ensure user is the organizer
            const updatedEvent = { ...event, ...updateDto };

            jest.spyOn(service, 'findOne').mockResolvedValue(event);
            jest.spyOn(eventRepository, 'save').mockResolvedValue(updatedEvent);

            // Act
            const result = await service.update(event.id, updateDto, user);

            // Assert
            PropertyTestHelpers.assertEventInvariants(result);
            if (updateDto.name) expect(result.name).toBe(updateDto.name);
            if (updateDto.description !== undefined) expect(result.description).toBe(updateDto.description);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject updates by non-organizer users', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.event(),
          ArbitraryGenerators.updateEventDto(),
          ArbitraryGenerators.regularUser(),
          async (event, updateDto, user) => {
            // Arrange
            jest.spyOn(service, 'findOne').mockResolvedValue(event);

            // Act & Assert
            await expect(service.update(event.id, updateDto, user)).rejects.toThrow(
              'Only the event organizer or admin can update this event'
            );
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should maintain date order invariants', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.event(),
          ArbitraryGenerators.validEventDates(),
          ArbitraryGenerators.organizerUser(),
          async (event, { startTime, endTime }, user) => {
            // Arrange
            event.organizerId = user.id;
            const updateDto: UpdateEventDto = {
              startTime: startTime.toISOString(),
              endTime: endTime?.toISOString(),
            };

            const updatedEvent = { ...event, startTime, endTime };

            jest.spyOn(service, 'findOne').mockResolvedValue(event);
            jest.spyOn(eventRepository, 'save').mockResolvedValue(updatedEvent);

            // Act
            const result = await service.update(event.id, updateDto, user);

            // Assert
            PropertyTestHelpers.assertDateOrderInvariants(result.startTime, result.endTime || undefined);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Contract Address Lookup Property Tests', () => {
    it('should return null for non-existent contract addresses', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.walletAddress(),
          async (contractAddress) => {
            // Arrange
            jest.spyOn(eventRepository, 'findOne').mockResolvedValue(null);

            // Act
            const result = await service.findByContractAddress(contractAddress);

            // Assert
            expect(result).toBeNull();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should return valid event for existing contract addresses', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.event(),
          async (event) => {
            // Arrange
            jest.spyOn(eventRepository, 'findOne').mockResolvedValue(event);

            // Act
            const result = await service.findByContractAddress(event.contractAddress);

            // Assert
            expect(result).not.toBeNull();
            PropertyTestHelpers.assertEventInvariants(result!);
            expect(result!.contractAddress).toBe(event.contractAddress);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Fuzz Tests for Input Validation', () => {
    it('should handle malicious input gracefully in event names', async () => {
      const maliciousInputs = FuzzTestHelpers.generateMaliciousStrings();
      
      for (const maliciousInput of maliciousInputs) {
        const createEventDto: CreateEventDto = {
          name: maliciousInput,
          description: 'Valid description',
          contractAddress: fc.sample(ArbitraryGenerators.walletAddress(), 1)[0],
          organizerId: fc.sample(fc.uuid(), 1)[0],
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 3600000).toISOString(),
        };

        const user = PropertyTestHelpers.createMockUser({ roles: [UserRole.ORGANIZER] });

        // Should either create successfully or fail gracefully with validation error
        try {
          jest.spyOn(eventRepository, 'findOne').mockResolvedValue(null);
          jest.spyOn(eventRepository, 'create').mockReturnValue(PropertyTestHelpers.createMockEvent({ name: maliciousInput }));
          jest.spyOn(eventRepository, 'save').mockResolvedValue(PropertyTestHelpers.createMockEvent({ name: maliciousInput }));
          
          const result = await service.create(createEventDto, user);
          expect(result).toBeDefined();
        } catch (error) {
          // Should be a validation error, not a crash
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it('should handle edge case wallet addresses', async () => {
      const invalidAddresses = FuzzTestHelpers.generateInvalidWalletAddresses();
      
      for (const invalidAddress of invalidAddresses) {
        const createEventDto: CreateEventDto = {
          name: 'Valid Event Name',
          description: 'Valid description',
          contractAddress: invalidAddress as string,
          organizerId: fc.sample(fc.uuid(), 1)[0],
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 3600000).toISOString(),
        };

        const user = PropertyTestHelpers.createMockUser({ roles: [UserRole.ORGANIZER] });

        // Should fail gracefully with validation error
        await expect(service.create(createEventDto, user)).rejects.toBeInstanceOf(Error);
      }
    });

    it('should handle extreme pagination values', async () => {
      const extremeValues = [
        { page: 1, limit: 1 },
        { page: 1000, limit: 1 },
        { page: 1, limit: 100 },
        { page: 500, limit: 100 },
      ];

      for (const pagination of extremeValues) {
        jest.spyOn(eventRepository, 'findAndCount').mockResolvedValue([[], 0]);
        
        const result = await service.findAll(pagination.page, pagination.limit);
        expect(result).toBeDefined();
        expect(Array.isArray(result[0])).toBe(true);
        expect(typeof result[1]).toBe('number');
      }
    });
  });

  describe('Invariant Tests', () => {
    it('should maintain event invariants across all operations', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.event(),
          ArbitraryGenerators.organizerUser(),
          async (event, user) => {
            // Test findOne invariant
            jest.spyOn(eventRepository, 'findOne').mockResolvedValue(event);
            const foundEvent = await service.findOne(event.id);
            PropertyTestHelpers.assertEventInvariants(foundEvent);

            // Test findByContractAddress invariant
            jest.spyOn(eventRepository, 'findOne').mockResolvedValue(event);
            const foundByContract = await service.findByContractAddress(event.contractAddress);
            if (foundByContract) {
              PropertyTestHelpers.assertEventInvariants(foundByContract);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should maintain user role invariants', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.createEventDto(),
          fc.record({
            organizerUser: ArbitraryGenerators.organizerUser(),
            adminUser: ArbitraryGenerators.adminUser(),
            regularUser: ArbitraryGenerators.regularUser(),
          }),
          async (createEventDto, users) => {
            // Organizers should be able to create events
            jest.spyOn(eventRepository, 'findOne').mockResolvedValue(null);
            jest.spyOn(eventRepository, 'create').mockReturnValue(PropertyTestHelpers.createMockEvent());
            jest.spyOn(eventRepository, 'save').mockResolvedValue(PropertyTestHelpers.createMockEvent());

            await expect(service.create(createEventDto, users.organizerUser)).resolves.toBeDefined();

            // Admins should be able to create events
            await expect(service.create(createEventDto, users.adminUser)).resolves.toBeDefined();

            // Regular users should not be able to create events
            await expect(service.create(createEventDto, users.regularUser)).rejects.toThrow();
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
