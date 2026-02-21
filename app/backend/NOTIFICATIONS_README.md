
# Real-Time Notification Service Documentation

## Overview

The Gatheraa Real-Time Notification Service is a comprehensive solution for sending notifications across multiple channels (email, push, in-app) with real-time delivery tracking, user preferences management, and detailed analytics.

## Features

- **WebSocket Gateway**: Real-time, bidirectional notifications via Socket.IO
- **Redis Pub/Sub**: Horizontal scaling using Redis with pub/sub messaging
- **Multiple Channels**: Email, Push, In-App, and SMS support
- **Notification Preferences**: Granular user control over notification types and channels
- **Delivery Tracking**: Track when notifications are sent, delivered, and read
- **Notification Templates**: Pre-designed templates for common notification types
- **Rate Limiting**: User-based rate limiting to prevent spam
- **Analytics**: Detailed metrics on notification performance
- **Retry Logic**: Automatic retry for failed deliveries

## Architecture

### Components

1. **NotificationsGateway** - WebSocket connection handler
2. **RedisAdapterService** - Redis pub/sub for horizontal scaling
3. **EmailNotificationProvider** - Email delivery via nodemailer
4. **PushNotificationProvider** - Push notifications via Firebase
5. **InAppNotificationProvider** - In-app notifications stored in database
6. **TemplateService** - Manages notification templates
7. **DeliveryService** - Handles delivery via different channels
8. **PreferencesService** - Manages user notification preferences
9. **AnalyticsService** - Tracks and reports on notifications

## Database Schema

### Notification
- `id` - UUID primary key
- `userId` - User receiving the notification
- `type` - Type of notification (email, push, in_app, sms)
- `category` - Category (event_reminder, ticket_sale, review, system_alert, etc.)
- `status` - Current status (pending, sent, delivered, failed, read)
- `title` - Notification title
- `message` - Notification content
- `data` - Additional JSON data
- `metadata` - Related entity IDs (eventId, ticketId, etc.)
- `read` - Whether user has read it
- `readAt` - When it was read
- `createdAt` - Creation timestamp

### NotificationPreferences
- `id` - UUID primary key
- `userId` - User ID
- `notificationsEnabled` - Global on/off switch
- `defaultChannels` - Default channels per type
- `categoryPreferences` - Per-category channel preferences
- `quietHours` - Do-not-disturb settings
- `frequency` - Digest frequency (immediate, daily, weekly)
- `pushEnabled` - Push notification toggle
- `deviceTokens` - List of device tokens
- `primaryEmail` - Email address
- `phoneNumber` - Phone number
- `language` - UI language preference
- `timezone` - User timezone
- `unsubscribedCategories` - List of unsubscribed categories

### NotificationTemplate
- `id` - UUID primary key
- `code` - Unique identifier (event_reminder_v1)
- `category` - Notification category
- `emailSubject` - Email subject line
- `emailTemplate` - Email HTML template
- `pushTitle` - Push notification title
- `pushMessage` - Push notification body
- `inAppTitle` - In-app notification title
- `inAppMessage` - In-app notification message
- `smsTemplate` - SMS template
- `variables` - List of template variables
- `defaultData` - Default values for variables

### NotificationDelivery
- `id` - UUID primary key
- `notificationId` - Reference to notification
- `userId` - User ID
- `channel` - Delivery channel
- `status` - Delivery status
- `recipientAddress` - Email/phone for the delivery
- `sentAt` - When delivered
- `deliveredAt` - Delivery confirmation time
- `openedAt` - When user opened
- `clickedAt` - When user clicked through
- `attemptCount` - Number of delivery attempts
- `lastAttemptAt` - Last attempt timestamp
- `providerMessageId` - External provider ID

### NotificationAnalytics
- `id` - UUID primary key
- `date` - Date of analytics
- `category` - Notification category
- `channel` - Delivery channel
- `totalSent` - Total notifications sent
- `totalDelivered` - Total delivered
- `totalOpened` - Total opened
- `totalClicked` - Total clicked
- `totalFailed` - Total failed
- `deliveryRate` - Percentage delivered
- `openRate` - Percentage opened
- `clickRate` - Percentage clicked

## API Endpoints

### User Notifications

#### GET `/notifications`
Get user's notifications with pagination.

Query parameters:
- `limit` - Results per page (default 20)
- `offset` - Pagination offset
- `category` - Filter by category
- `status` - Filter by status
- `unreadOnly` - Only unread notifications

Response:
```json
{
  "notifications": [
    {
      "id": "uuid",
      "userId": "uuid",
      "title": "New Review",
      "message": "Someone reviewed your event",
      "type": "in_app",
      "category": "review",
      "status": "sent",
      "read": false,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 42
}
```

#### GET `/notifications/unread-count`
Get count of unread notifications.

Response:
```json
{
  "count": 5
}
```

####  POST `/notifications`
Create and send a notification to the current user.

Body:
```json
{
  "type": "in_app",
  "category": "event_reminder",
  "title": "Event Reminder",
  "message": "Your event starts in 1 hour",
  "data": { "eventId": "uuid" },
  "sendImmediately": true
}
```

#### PUT `/notifications/:id/read`
Mark a notification as read.

#### PUT `/notifications/read/all`
Mark all notifications as read.

#### DELETE `/notifications/:id`
Delete a notification.

### Preferences

#### GET `/notifications/preferences/me`
Get current user's notification preferences.

Response:
```json
{
  "id": "uuid",
  "userId": "uuid",
  "notificationsEnabled": true,
  "defaultChannels": {
    "email": true,
    "push": true,
    "inApp": true,
    "sms": false
  },
  "categoryPreferences": {
    "eventReminder": { "email": true, "push": true, "inApp": true },
    "ticketSale": { "email": true, "push": true, "inApp": true },
    "review": { "email": true, "push": false, "inApp": true }
  },
  "quietHours": {
    "enabled": true,
    "startTime": "22:00",
    "endTime": "08:00"
  },
  "frequency": "immediate",
  "language": "en-US",
  "timezone": "UTC"
}
```

#### PUT `/notifications/preferences/me`
Update notification preferences.

Body:
```json
{
  "notificationsEnabled": true,
  "quietHours": {
    "enabled": true,
    "startTime": "22:00",
    "endTime": "08:00",
    "timezone": "America/New_York"
  },
  "categoryPreferences": {
    "eventReminder": {
      "email": true,
      "push": true,
      "inApp": true,
      "sms": false
    }
  }
}
```

#### POST `/notifications/preferences/device-token`
Add a device token for push notifications.

Body:
```json
{
  "deviceToken": "firebase-device-token"
}
```

#### DELETE `/notifications/preferences/device-token/:token`
Remove a device token.

#### POST `/notifications/preferences/unsubscribe/:category`
Unsubscribe from a specific category.

#### POST `/notifications/preferences/subscribe/:category`
Resubscribe to a category.

#### POST `/notifications/preferences/unsubscribe-all`
Unsubscribe from all notifications.

### Templates

#### GET `/notifications/templates`
Get all enabled notification templates.

#### POST `/notifications/templates`
Create a new notification template (admin).

Body:
```json
{
  "code": "event_reminder_v1",
  "name": "Event Reminder",
  "description": "Reminder notification for upcoming events",
  "category": "event_reminder",
  "emailSubject": "Reminder: {{eventName}} is starting soon",
  "emailTemplate": "<h1>{{eventName}}</h1><p>Your event starts in {{hoursRemaining}} hours.</p>",
  "pushTitle": "Event Reminder",
  "pushMessage": "{{eventName}} starts in {{hoursRemaining}} hours",
  "inAppTitle": "Upcoming Event",
  "inAppMessage": "{{eventName}} starts in {{hoursRemaining}} hours",
  "variables": ["eventName", "hoursRemaining"]
}
```

#### GET `/notifications/templates/:id`
Get a specific template.

#### PUT `/notifications/templates/:id`
Update a template (admin).

#### DELETE `/notifications/templates/:id`
Delete a template (admin).

### Analytics

#### GET `/notifications/analytics/summary`
Get analytics summary for a date range.

Query parameters:
- `dateFrom` - Start date (ISO format)
- `dateTo` - End date (ISO format)

Response:
```json
{
  "totalSent": 1000,
  "totalDelivered": 950,
  "totalOpened": 450,
  "totalClicked": 150,
  "totalFailed": 50,
  "deliveryRate": 95.0,
  "openRate": 47.4,
  "clickRate": 33.3
}
```

#### GET `/notifications/analytics/category`
Get analytics breakdown by category.

## WebSocket Events

### Client Events

#### `subscribe_notifications`
Subscribe to real-time notifications.

Emit:
```javascript
socket.emit('subscribe_notifications', { userId: 'uuid' });
```

#### `mark_as_read`
Mark a notification as read in real-time.

Emit:
```javascript
socket.emit('mark_as_read', { notificationId: 'uuid' });
```

#### `mark_all_as_read`
Mark all notifications as read.

Emit:
```javascript
socket.emit('mark_all_as_read');
```

#### `delete_notification`
Delete a notification.

Emit:
```javascript
socket.emit('delete_notification', { notificationId: 'uuid' });
```

#### `get_unread_count`
Get unread notification count.

Emit:
```javascript
socket.emit('get_unread_count');
```

### Server Events

#### `connection_established`
Emitted when WebSocket connection is established.

Data:
```javascript
{
  message: 'Connected to notification service',
  userId: 'uuid'
}
```

#### `notification_received`
Emitted when a new notification is received.

Data:
```javascript
{
  id: 'uuid',
  title: 'New Review',
  message: 'Someone reviewed your event',
  category: 'review',
  type: 'in_app',
  createdAt: '2024-01-01T00:00:00Z',
  data: {},
  metadata: {}
}
```

#### `notification_read`
Emitted when a notification is marked as read.

Data:
```javascript
{
  notificationId: 'uuid',
  success: true
}
```

#### `notification_deleted`
Emitted when a notification is deleted.

Data:
```javascript
{
  notificationId: 'uuid',
  success: true
}
```

#### `unread_count`
Response to `get_unread_count` event.

Data:
```javascript
{
  count: 5
}
```

## Using the Service

### Creating a Notification

```typescript
import { NotificationsService } from './notifications/notifications.service';
import { NotificationType, NotificationCategory } from './notifications/entities';

constructor(private notificationsService: NotificationsService) {}

async sendReviewNotification(reviewId: string, userId: string) {
  await this.notificationsService.createAndSendNotification({
    userId,
    type: NotificationType.IN_APP,
    category: NotificationCategory.REVIEW,
    title: 'New Review Received',
    message: 'Someone left a review on your event',
    metadata: {
      reviewId,
      actionUrl: `/reviews/${reviewId}`
    },
    sendImmediately: true
  });
}
```

### Sending Bulk Notifications

```typescript
async notifyAllAttendees(eventId: string, userIds: string[]) {
  await this.notificationsService.sendBulkNotifications({
    userIds,
    types: [NotificationType.EMAIL, NotificationType.PUSH],
    category: NotificationCategory.EVENT_REMINDER,
    title: 'Event Starting Soon',
    message: 'Your event is starting in 1 hour',
    metadata: { eventId },
    respectPreferences: true
  });
}
```

### Handling WebSocket Notifications (Frontend)

```typescript
// Connect to notification service
const socket = io('http://localhost:3000/notifications', {
  auth: {
    token: jwtToken
  }
});

// Listen for notifications
socket.on('notification_received', (notification) => {
  console.log('New notification:', notification);
  showNotificationUi(notification);
});

// Mark as read
socket.emit('mark_as_read', { notificationId: 'uuid' });

// Get unread count
socket.emit('get_unread_count');
socket.on('unread_count', (data) => {
  updateUnreadBadge(data.count);
});

// Subscribe to notifications
socket.emit('subscribe_notifications');
```

## Configuration

### Environment Variables

```env
# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@gatheraa.com

# Or SMTP configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=user
SMTP_PASSWORD=password

# Firebase Configuration
FIREBASE_CREDENTIALS_PATH=/path/to/firebase-credentials.json
# Or provide credentials as JSON
FIREBASE_CREDENTIALS=[{"type": "service_account", ...}]
FIREBASE_PROJECT_ID=your-project-id

# Redis Configuration
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your-jwt-secret
```

## Rate Limiting

The notification service enforces per-user rate limiting:
- Default: 100 notifications per hour per user
- Enforced via cache manager with expiration
- Configurable via service constants

## Horizontal Scaling

The notification system is designed for horizontal scaling:

1. **Redis Pub/Sub**: All instances subscribe to Redis channels for message distribution
2. **Socket.IO Redis Adapter**: WebSocket connections distributed via Redis
3. **Database**: Shared database for persistent state
4. **Cache**: Distributed cache via cache-manager

To scale:
1. Run multiple instances of the NestJS application
2. Configure same Redis instance for all instances
3. Load balance WebSocket connections across instances
4. System automatically handles message distribution

## Testing

### Unit Tests

```bash
npm run test -- notifications.service.spec.ts
```

### E2E Tests

```bash
npm run test:e2e -- notifications.e2e-spec.ts
```

### Health Check

```bash
curl http://localhost:3000/notifications/health
```

## Troubleshooting

### Notifications not sending
1. Check Redis connection: `REDIS_URL` environment variable
2. Verify email credentials for email notifications
3. Check Firebase credentials for push notifications
4. Review application logs for errors

### WebSocket connection issues
1. Ensure JWT token is valid
2. Check CORS configuration
3. Verify Socket.IO transports are enabled
4. Check for network/firewall issues

### Rate limiting too strict
1. Adjust `DEFAULT_RATE_LIMIT` constant in notifications.service.ts
2. Adjust cache TTL for rate limit window
3. Implement user-tier-based rate limits

## Performance Considerations

- Notification queries use indexes on userId and createdAt
- Analytics are aggregated once daily
- Delivery tracking is asynchronous
- Cache is used for user preferences and unread counts
- Redis pub/sub efficiently distributes messages across instances

## Security

- All endpoints require JWT authentication
- WebSocket connections validated with JWT tokens
- Rate limiting prevents notification spam
- User preferences prevent unsolicited notifications
- Sensitive data (phone numbers, emails) stored encrypted in preferences

## Future Enhancements

- SMS notifications via Twilio
- WhatsApp notifications
- Slack integration
- Custom notification channels
- Advanced segmentation and targeting
- Notification scheduling/campaigns
- A/B testing for notification content
- Machine learning for optimal send times
