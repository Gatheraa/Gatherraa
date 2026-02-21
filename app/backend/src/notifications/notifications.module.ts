import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './gateway/notifications.gateway';
import {
  Notification,
  NotificationPreferences,
  NotificationTemplate,
  NotificationDelivery,
  NotificationAnalytics,
} from './entities';
import {
  RedisAdapterService,
  EmailNotificationProvider,
  PushNotificationProvider,
  InAppNotificationProvider,
} from './providers';
import {
  TemplateService,
  DeliveryService,
  AnalyticsService,
  PreferencesService,
} from './services';
import { NotificationsController } from './notifications.controller';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationPreferences,
      NotificationTemplate,
      NotificationDelivery,
      NotificationAnalytics,
      User,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  providers: [
    NotificationsService,
    NotificationsGateway,
    RedisAdapterService,
    EmailNotificationProvider,
    PushNotificationProvider,
    InAppNotificationProvider,
    TemplateService,
    DeliveryService,
    AnalyticsService,
    PreferencesService,
  ],
  exports: [NotificationsService, NotificationsGateway],
  controllers: [NotificationsController],
})
export class NotificationsModule {}
