import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { NotificationsService } from '../notifications/notifications.service';
import { PreferencesService } from '../notifications/services/preferences.service';
import { NotificationType, NotificationCategory } from '../notifications/entities';
import { DeliveryChannel } from '../notifications/entities/notification-delivery.entity';

describe('Notifications Service Integration Tests', () => {
  let app: INestApplication;
  let notificationsService: NotificationsService;
  let preferencesService: PreferencesService;
  let jwtToken: string;
  let testUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    notificationsService = moduleFixture.get<NotificationsService>(NotificationsService);
    preferencesService = moduleFixture.get<PreferencesService>(PreferencesService);

    // Mock JWT token and user ID
    testUserId = '550e8400-e29b-41d4-a716-446655440000';
    jwtToken = 'test-jwt-token';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Notification Creation and Sending', () => {
    it('should create and send notification', async () => {
      const notification = await notificationsService.createAndSendNotification({
        userId: testUserId,
        type: NotificationType.IN_APP,
        category: NotificationCategory.EVENT_REMINDER,
        title: 'Test Notification',
        message: 'This is a test notification',
        sendImmediately: true,
      });

      expect(notification).toBeDefined();
      expect(notification.id).toBeDefined();
      expect(notification.userId).toBe(testUserId);
      expect(notification.title).toBe('Test Notification');
    });

    it('should create multiple notifications for bulk send', async () => {
      const userIds = [
        '550e8400-e29b-41d4-a716-446655440001',
        '550e8400-e29b-41d4-a716-446655440002',
        '550e8400-e29b-41d4-a716-446655440003',
      ];

      const notifications = await notificationsService.sendBulkNotifications({
        userIds,
        types: [NotificationType.IN_APP],
        category: NotificationCategory.TICKET_SALE,
        title: 'Bulk Test',
        message: 'Bulk notification test',
      });

      expect(notifications).toHaveLength(3);
      expect(notifications.every((n) => userIds.includes(n.userId))).toBe(true);
    });

    it('should enforce rate limiting', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440010';

      // Try to create more than rate limit notifications
      let error: Error | undefined;

      try {
        for (let i = 0; i < 101; i++) {
          await notificationsService.createAndSendNotification({
            userId,
            type: NotificationType.IN_APP,
            category: NotificationCategory.SYSTEM_ALERT,
            title: `Notification ${i}`,
            message: `Test ${i}`,
            sendImmediately: false,
          });
        }
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error?.message).toContain('Rate limit exceeded');
    });
  });

  describe('Notification Preferences', () => {
    const preferenceUserId = '550e8400-e29b-41d4-a716-446655440020';

    it('should create default preferences for new user', async () => {
      const prefs = await preferencesService.getUserPreferences(preferenceUserId);

      expect(prefs).toBeDefined();
      expect(prefs.userId).toBe(preferenceUserId);
      expect(prefs.notificationsEnabled).toBe(true);
      expect(prefs.frequency).toBe('immediate');
    });

    it('should update user preferences', async () => {
      const updated = await preferencesService.updateUserPreferences(preferenceUserId, {
        notificationsEnabled: true,
        quietHours: {
          enabled: true,
          startTime: '22:00',
          endTime: '08:00',
        },
        frequency: 'daily_digest',
      });

      expect(updated.frequency).toBe('daily_digest');
      expect(updated.quietHours?.enabled).toBe(true);
    });

    it('should add and remove device token', async () => {
      const token = 'firebase_device_token_123';

      const afterAdd = await preferencesService.addDeviceToken(preferenceUserId, token);
      expect(afterAdd.deviceTokens).toContain(token);

      const afterRemove = await preferencesService.removeDeviceToken(preferenceUserId, token);
      expect(afterRemove.deviceTokens).not.toContain(token);
    });

    it('should unsubscribe from category', async () => {
      const updated = await preferencesService.unsubscribeFromCategory(
        preferenceUserId,
        NotificationCategory.MARKETING,
      );

      expect(updated.unsubscribedCategories).toContain(NotificationCategory.MARKETING);
    });

    it('should subscribe to category', async () => {
      await preferencesService.unsubscribeFromCategory(preferenceUserId, NotificationCategory.REVIEW);

      const updated = await preferencesService.subscribeToCategory(preferenceUserId, NotificationCategory.REVIEW);

      expect(updated.unsubscribedCategories).not.toContain(NotificationCategory.REVIEW);
    });

    it('should unsubscribe from all notifications', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440021';

      const updated = await preferencesService.unsubscribeFromAll(userId);

      expect(updated.unsubscribedFromAll).toBe(true);
    });
  });

  describe('Notification Management', () => {
    const managementUserId = '550e8400-e29b-41d4-a716-446655440030';

    it('should get user notifications', async () => {
      // Create some notifications first
      const notif1 = await notificationsService.createAndSendNotification({
        userId: managementUserId,
        type: NotificationType.IN_APP,
        category: NotificationCategory.EVENT_REMINDER,
        title: 'Notification 1',
        message: 'Test 1',
      });

      const notif2 = await notificationsService.createAndSendNotification({
        userId: managementUserId,
        type: NotificationType.IN_APP,
        category: NotificationCategory.REVIEW,
        title: 'Notification 2',
        message: 'Test 2',
      });

      const result = await notificationsService.getNotifications(managementUserId, {
        limit: 10,
        offset: 0,
      });

      expect(result.notifications.length).toBeGreaterThan(0);
      expect(
        result.notifications.some((n) => n.id === notif1.id || n.id === notif2.id),
      ).toBe(true);
    });

    it('should get unread count', async () => {
      const count = await notificationsService.getUnreadCount(managementUserId);

      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should mark notification as read', async () => {
      const notif = await notificationsService.createAndSendNotification({
        userId: managementUserId,
        type: NotificationType.IN_APP,
        category: NotificationCategory.COMMENT,
        title: 'Comment Notification',
        message: 'New comment',
      });

      const marked = await notificationsService.markAsRead(managementUserId, notif.id);

      expect(marked.read).toBe(true);
      expect(marked.readAt).toBeDefined();
    });

    it('should mark all notifications as read', async () => {
      await notificationsService.createAndSendNotification({
        userId: managementUserId,
        type: NotificationType.IN_APP,
        category: NotificationCategory.FOLLOWER,
        title: 'New Follower',
        message: 'Someone followed you',
      });

      const count = await notificationsService.markAllAsRead(managementUserId);

      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should delete notification', async () => {
      const notif = await notificationsService.createAndSendNotification({
        userId: managementUserId,
        type: NotificationType.IN_APP,
        category: NotificationCategory.SYSTEM_ALERT,
        title: 'Alert to Delete',
        message: 'Delete me',
      });

      await notificationsService.deleteNotification(managementUserId, notif.id);

      const result = await notificationsService.getNotifications(managementUserId, {
        limit: 100,
        offset: 0,
      });

      expect(result.notifications.find((n) => n.id === notif.id)).toBeUndefined();
    });
  });

  describe('API Endpoints', () => {
    const apiTestUserId = '550e8400-e29b-41d4-a716-446655440040';

    // Note: These tests require proper JWT token setup in the application
    // Update the token and userId based on your auth implementation

    it('should GET /notifications with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications?limit=10&offset=0')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('notifications');
      expect(response.body).toHaveProperty('total');
      expect(Array.isArray(response.body.notifications)).toBe(true);
    });

    it('should GET /notifications/unread-count', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('count');
      expect(typeof response.body.count).toBe('number');
    });

    it('should GET /notifications/preferences/me', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications/preferences/me')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('notificationsEnabled');
      expect(response.body).toHaveProperty('defaultChannels');
      expect(response.body).toHaveProperty('categoryPreferences');
    });

    it('should PUT /notifications/preferences/me', async () => {
      const response = await request(app.getHttpServer())
        .put('/notifications/preferences/me')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          notificationsEnabled: false,
          language: 'es-ES',
        })
        .expect(200);

      expect(response.body.notificationsEnabled).toBe(false);
      expect(response.body.language).toBe('es-ES');
    });

    it('should GET /notifications/templates', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications/templates')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should GET /notifications/health', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
    });
  });

  describe('Channel Preferences', () => {
    const channelUserId = '550e8400-e29b-41d4-a716-446655440050';

    it('should respect email channel preference', async () => {
      // Set preferences to disable email
      await preferencesService.updateUserPreferences(channelUserId, {
        categoryPreferences: {
          eventReminder: {
            email: false,
            push: true,
            inApp: true,
          },
        },
      });

      const prefs = await preferencesService.getUserPreferences(channelUserId);

      expect(prefs.categoryPreferences.eventReminder?.email).toBe(false);
      expect(prefs.categoryPreferences.eventReminder?.push).toBe(true);
    });

    it('should respect push channel preference', async () => {
      await preferencesService.updateUserPreferences(channelUserId, {
        pushEnabled: false,
      });

      const prefs = await preferencesService.getUserPreferences(channelUserId);

      expect(prefs.pushEnabled).toBe(false);
    });

    it('should respect quiet hours', async () => {
      await preferencesService.updateUserPreferences(channelUserId, {
        quietHours: {
          enabled: true,
          startTime: '22:00',
          endTime: '08:00',
          timezone: 'America/New_York',
        },
      });

      const prefs = await preferencesService.getUserPreferences(channelUserId);

      expect(prefs.quietHours?.enabled).toBe(true);
      expect(prefs.quietHours?.startTime).toBe('22:00');
    });
  });

  describe('Error Handling', () => {
    it('should handle notification not found', async () => {
      const nonExistentId = '99999999-9999-9999-9999-999999999999';

      await expect(notificationsService.markAsRead(testUserId, nonExistentId)).rejects.toThrow(
        'Notification not found',
      );
    });

    it('should handle invalid user ID', async () => {
      // Ensure graceful handling of operations with no matching user
      const result = await notificationsService.getNotifications('invalid-uuid', {
        limit: 10,
        offset: 0,
      });

      expect(result.notifications).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('Health Checks', () => {
    it('should pass health check', async () => {
      const isHealthy = await notificationsService.healthCheck();

      expect(typeof isHealthy).toBe('boolean');
    });
  });
});
