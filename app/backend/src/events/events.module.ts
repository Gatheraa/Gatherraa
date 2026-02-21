import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsController } from './events.controller';
import { Event } from './entities/event.entity';
import { EventWriteModel } from './entities/event-write.entity';
import { EventReadModel } from './entities/event-read.entity';
import { EventVersion } from './entities/event-version.entity';
import { CreateEventHandler } from './commands/create-event.handler';
import { UpdateEventHandler } from './commands/update-event.handler';
import { DeleteEventHandler } from './commands/delete-event.handler';
import { BulkCreateEventsHandler } from './commands/bulk-create-events.handler';
import { GetEventByIdHandler } from './queries/get-event-by-id.handler';
import { GetEventsHandler } from './queries/get-events.handler';
import { GetEventsByOrganizerHandler } from './queries/get-events-by-organizer.handler';
import { EventsService } from './events.service';
import { EventSourcingService } from './services/event-sourcing.service';
import { ConcurrencyService } from './services/concurrency.service';
import { MaterializedViewService } from './services/materialized-view.service';

export const CommandHandlers = [
  CreateEventHandler,
  UpdateEventHandler,
  DeleteEventHandler,
  BulkCreateEventsHandler,
];

export const QueryHandlers = [
  GetEventByIdHandler,
  GetEventsHandler,
  GetEventsByOrganizerHandler,
];

export const Services = [
  EventsService,
  EventSourcingService,
  ConcurrencyService,
  MaterializedViewService,
];

@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly eventRecommendationService: EventRecommendationService,
  ) {}
  @Get('recommendations')
  async getRecommendations(@Query('userId') userId?: string, @Query('limit', new DefaultValuePipe(10)) limit: number) {
    const events = await this.eventRecommendationService.getRecommendedEvents(userId, limit);
    return { data: plainToInstance(EventResponseDto, events) };
  }
}
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([
      Event, // Traditional entity
      EventWriteModel,
      EventReadModel,
      EventVersion,
    ]),
  ],
  controllers: [EventsController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    ...Services,
  ],
  exports: [
    ...Services,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
})
export class EventsModule {}
