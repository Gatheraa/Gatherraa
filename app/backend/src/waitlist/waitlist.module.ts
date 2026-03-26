import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WaitlistEntry, WaitlistAnalytics } from './entities';
import { WaitlistService } from './services/waitlist.service';
import { WaitlistController } from './waitlist.controller';
import { EventsModule } from '../events/events.module';
import { UsersModule } from '../users/users.module';
import { BookingModule } from '../booking/booking.module';
import { TaskQueueModule } from '../task-queue/task-queue.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([WaitlistEntry, WaitlistAnalytics]),
        EventsModule,
        UsersModule,
        forwardRef(() => BookingModule),
        TaskQueueModule,
        NotificationsModule,
    ],
    controllers: [WaitlistController],
    providers: [WaitlistService],
    exports: [WaitlistService],
})
export class WaitlistModule { }
