import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto, UpdateEventDto, BulkCreateEventsDto, EventQueryDto } from './dto/event.dto';
import { CreateEventDto as CreateEventDtoSimple } from './dto/create-event.dto';
import { UpdateEventDto as UpdateEventDtoSimple } from './dto/update-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { User } from '../users/entities/user.entity';
import { EventResponseDto } from './dto/event-response.dto';
import { plainToInstance } from 'class-transformer';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // Traditional REST endpoints (using @CurrentUser decorator)
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() createEventDto: CreateEventDtoSimple, @CurrentUser() user: User): Promise<EventResponseDto> {
    const event = await this.eventsService.create(createEventDto, user);
    return plainToInstance(EventResponseDto, event);
  }

  @Get()
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<{ data: EventResponseDto[]; total: number; page: number; limit: number }> {
    const [events, total] = await this.eventsService.findAll(page, limit);
    return {
      data: plainToInstance(EventResponseDto, events),
      total,
      page,
      limit,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<EventResponseDto> {
    const event = await this.eventsService.findOne(id);
    return plainToInstance(EventResponseDto, event);
  }

  @Get('cqrs')
  @UseGuards(JwtAuthGuard)
  async getEvents(@Query() query: EventQueryDto) {
    const result = await this.queryBus.execute(new GetEventsQuery(query, query.limit, query.offset));
    return {
      data: plainToInstance(EventResponseDto, result.events),
      total: result.total,
      page: Math.floor(query.offset / query.limit) + 1,
      limit: query.limit,
    };
  }
  
  @Get('suggestions')
  async getSearchSuggestions(@Query('q') query: string, @Query('limit', new DefaultValuePipe(10)) limit: number) {
    if (!query) return { suggestions: [] };
    const suggestions = await this.eventReadModelRepository
      .createQueryBuilder('event')
      .select('DISTINCT event.title')
      .where('event.title LIKE :query', { query: `${query}%` })
      .andWhere('event.isDeleted = false')
      .limit(limit)
      .getRawMany();
    return { suggestions: suggestions.map(s => s.event_title) };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDtoSimple,
    @CurrentUser() user: User,
  ): Promise<EventResponseDto> {
    const event = await this.eventsService.update(id, updateEventDto, user);
    return plainToInstance(EventResponseDto, event);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @CurrentUser() user: User): Promise<{ message: string }> {
    await this.eventsService.remove(id, user);
    return { message: 'Event deleted successfully' };
  }

  // CQRS-based endpoints (using query parameters)
  @Post('cqrs')
  @UseGuards(JwtAuthGuard)
  async createEvent(@Body() dto: CreateEventDto, @Query('userId') userId: string, @Query('userName') userName?: string) {
    return await this.eventsService.createEvent(dto, userId, userName);
  }

  @Put('cqrs/:id')
  @UseGuards(JwtAuthGuard)
  async updateEvent(@Param('id') id: string, @Body() dto: UpdateEventDto, @Query('userId') userId: string, @Query('userName') userName?: string) {
    return await this.eventsService.updateEvent(id, dto, userId, userName);
  }

  @Delete('cqrs/:id')
  @UseGuards(JwtAuthGuard)
  async deleteEvent(@Param('id') id: string, @Query('userId') userId: string, @Query('userName') userName?: string) {
    return await this.eventsService.deleteEvent(id, userId, userName);
  }

  @Post('bulk')
  @UseGuards(JwtAuthGuard)
  async bulkCreateEvents(@Body() dto: BulkCreateEventsDto, @Query('userId') userId: string, @Query('userName') userName?: string) {
    return await this.eventsService.bulkCreateEvents(dto, userId, userName);
  }

  @Get('cqrs/:id')
  @UseGuards(JwtAuthGuard)
  async getEventById(@Param('id') id: string) {
    return await this.eventsService.getEventById(id);
  }

  @Get('cqrs')
  @UseGuards(JwtAuthGuard)
  async getEvents(@Query() query: EventQueryDto) {
    return await this.eventsService.getEvents(query);
  }

  @Get('organizer/:organizerId')
  @UseGuards(JwtAuthGuard)
  async getEventsByOrganizer(@Param('organizerId') organizerId: string, @Query() query: EventQueryDto) {
    return await this.eventsService.getEventsByOrganizer(organizerId, query);
  }
}
