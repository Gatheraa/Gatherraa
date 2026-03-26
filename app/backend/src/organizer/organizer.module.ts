import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizerController } from './organizer.controller';
import { OrganizerService } from './organizer.service';
import { OrganizerGateway } from './organizer.gateway';
import { Event } from '../events/entities/event.entity';
import { Booking, BookingItem, Seat } from '../booking/entities/booking.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, Booking, BookingItem, Seat, User]),
    NotificationsModule,
  ],
  controllers: [OrganizerController],
  providers: [OrganizerService, OrganizerGateway],
  exports: [OrganizerService],
})
export class OrganizerModule {}
