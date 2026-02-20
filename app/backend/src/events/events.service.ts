import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Event } from './entities/event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { CreateEventCommand } from './commands/create-event.command';
import { UpdateEventCommand } from './commands/update-event.command';
import { DeleteEventCommand } from './commands/delete-event.command';
import { BulkCreateEventsCommand } from './commands/bulk-create-events.command';
import { CreateEventDto as CreateEventDtoCQRS, UpdateEventDto as UpdateEventDtoCQRS, BulkCreateEventsDto } from './dto/event.dto';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // Traditional REST methods (using TypeORM repository)
  async create(createEventDto: CreateEventDto, user: User): Promise<Event> {
    // Check if user is organizer or admin
    if (!user.roles.includes(UserRole.ORGANIZER) && !user.roles.includes(UserRole.ADMIN)) {
      throw new ForbiddenException('Only organizers and admins can create events');
    }

    // Check if contract address already exists
    const existingEvent = await this.eventRepository.findOne({
      where: { contractAddress: createEventDto.contractAddress },
    });

    if (existingEvent) {
      throw new ForbiddenException('Event with this contract address already exists');
    }

    const event = this.eventRepository.create({
      ...createEventDto,
      organizerId: createEventDto.organizerId || user.id,
      startTime: new Date(createEventDto.startTime),
      endTime: createEventDto.endTime ? new Date(createEventDto.endTime) : null,
    });

    return await this.eventRepository.save(event);
  }

  async findAll(page: number = 1, limit: number = 20): Promise<[Event[], number]> {
    const skip = (page - 1) * limit;
    return await this.eventRepository.findAndCount({
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: ['organizer'],
    });
  }

  async findOne(id: string): Promise<Event> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['organizer'],
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    return event;
  }

  async findByContractAddress(contractAddress: string): Promise<Event | null> {
    return await this.eventRepository.findOne({
      where: { contractAddress },
      relations: ['organizer'],
    });
  }

  async update(id: string, updateEventDto: UpdateEventDto, user: User): Promise<Event> {
    const event = await this.findOne(id);

    // Check if user is organizer of this event or admin
    if (event.organizerId !== user.id && !user.roles.includes(UserRole.ADMIN)) {
      throw new ForbiddenException('Only the event organizer or admin can update this event');
    }

    if (updateEventDto.startTime) {
      event.startTime = new Date(updateEventDto.startTime);
    }
    if (updateEventDto.endTime !== undefined) {
      event.endTime = updateEventDto.endTime ? new Date(updateEventDto.endTime) : null;
    }
    if (updateEventDto.name) {
      event.name = updateEventDto.name;
    }
    if (updateEventDto.description !== undefined) {
      event.description = updateEventDto.description;
    }

    return await this.eventRepository.save(event);
  }

  async remove(id: string, user: User): Promise<void> {
    const event = await this.findOne(id);

    // Only admin can delete events
    if (!user.roles.includes(UserRole.ADMIN)) {
      throw new ForbiddenException('Only admins can delete events');
    }

    await this.eventRepository.remove(event);
  }

  // CQRS-based methods (using CommandBus/QueryBus)
  async createEvent(dto: CreateEventDtoCQRS, userId: string, userName?: string) {
    return await this.commandBus.execute(
      new CreateEventCommand(dto, userId, userName),
    );
  }

  async updateEvent(id: string, dto: UpdateEventDtoCQRS, userId: string, userName?: string) {
    return await this.commandBus.execute(
      new UpdateEventCommand(id, dto, userId, userName),
    );
  }

  async deleteEvent(id: string, userId: string, userName?: string) {
    return await this.commandBus.execute(
      new DeleteEventCommand(id, userId, userName),
    );
  }

  async bulkCreateEvents(dto: BulkCreateEventsDto, userId: string, userName?: string) {
    return await this.commandBus.execute(
      new BulkCreateEventsCommand(dto, userId, userName),
    );
  }

  async getEventById(id: string) {
    // This will be implemented with query handlers
    return { message: 'Query handler not implemented yet' };
  }

  async getEvents(query: any) {
    // This will be implemented with query handlers
    return { message: 'Query handler not implemented yet' };
  }

  async getEventsByOrganizer(organizerId: string, query: any) {
    // This will be implemented with query handlers
    return { message: 'Query handler not implemented yet' };
  }
}
