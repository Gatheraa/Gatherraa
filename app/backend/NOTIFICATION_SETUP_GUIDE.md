# Real-Time Notification Service - Getting Started Guide

## Quick Setup (5 minutes)

### 1. Install Dependencies

```bash
cd app/backend
npm install
```

The following packages were added:
- `@nestjs/websockets` and `@nestjs/socket.io` - WebSocket support
- `socket.io` and `socket.io-redis` - Socket.IO with Redis adapter
- `firebase-admin` - Firebase Cloud Messaging
- `nodemailer` - Email sending

### 2. Configure Environment Variables

Create or update `.env` file in `app/backend/`:

```env
# Database
DATABASE_PATH=./database.sqlite

# Mail Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@gatheraa.com

# Firebase (for push notifications)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CREDENTIALS={"type":"service_account",...full json...}

# Redis (for pub/sub and scaling)
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key-here

# Server
PORT=3000
NODE_ENV=development
```

### 3. Start Redis (if running locally)

```bash
# Using Docker
docker run -d -p 6379:6379 redis:latest

# Or if Redis installed locally
redis-server
```

### 4. Run Application

```bash
npm run start:dev
```

### 5. Verify Installation

```bash
# Check health endpoint
curl http://localhost:3000/notifications/health

# Should return
# {"status":"healthy"}
```

## API Quick Test

### Create a Notification (REST)

```bash
curl -X POST http://localhost:3000/notifications \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "in_app",
    "category": "event_reminder",
    "title": "Test Notification",
    "message": "This is a test",
    "sendImmediately": true
  }'
```

### Connect via WebSocket (JavaScript)

```javascript
// In browser console or Node.js
const socket = io('http://localhost:3000/notifications', {
  auth: {
    token: 'your-jwt-token'
  }
});

socket.on('connection_established', (data) => {
  console.log('Connected:', data);
});

socket.on('notification_received', (notification) => {
  console.log('New notification:', notification);
});

// Get unread count
socket.emit('get_unread_count');
socket.on('unread_count', (data) => {
  console.log('Unread count:', data.count);
});
```

## Key Files to Review

1. **Core Service**
   - `src/notifications/notifications.service.ts` - Main notification logic

2. **WebSocket**
   - `src/notifications/gateway/notifications.gateway.ts` - Real-time events

3. **Entities**
   - `src/notifications/entities/` - Database schemas

4. **Tests**
   - `test/notifications.integration.spec.ts` - Integration tests

5. **Documentation**
   - `docs/NOTIFICATIONS_README.md` - Full API documentation
   - `NOTIFICATION_IMPLEMENTATION_SUMMARY.md` - Architecture overview

## Run Tests

```bash
# All tests
npm test

# Notifications only
npm test -- notifications

# With coverage
npm test:cov -- notifications

# Integration tests
npm run test:e2e -- notifications.integration.spec.ts
```

## Common Integration Points

### In Reviews Module

```typescript
// When a new review is created
async createReview(dto: CreateReviewDto) {
  const review = await this.reviewRepository.save(/* ... */);
  
  // Notify organizer
  await this.notificationsService.sendReviewNotification(review, event);
}
```

### In Events Module

```typescript
// When event is about to start
async sendEventReminders() {
  const upcomingEvents = await this.eventsRepository.find({
    where: { startsAt: between(now, now + 1 hour) }
  });
  
  for (const event of upcomingEvents) {
    await this.notificationsService.sendBulkNotifications({
      userIds: event.attendeeIds,
      types: [NotificationType.IN_APP, NotificationType.PUSH],
      category: NotificationCategory.EVENT_REMINDER,
      title: `${event.name} starts soon!`,
      message: `Your event starts in 1 hour`,
      metadata: { eventId: event.id }
    });
  }
}
```

### In Ticket Sales

```typescript
// When ticket is purchased
async purchaseTicket(ticketId: string, userId: string) {
  const ticket = await this.ticketRepository.save(/* ... */);
  
  // Notify organizer
  await this.notificationsService.createAndSendNotification({
    userId: ticket.event.organizerId,
    type: NotificationType.IN_APP,
    category: NotificationCategory.TICKET_SALE,
    title: 'Ticket Sold!',
    message: `${user.firstName} purchased a ticket`,
    metadata: { ticketId: ticket.id }
  });
}
```

## Customization Guide

### Adding a New Notification Type

1. Add to `NotificationCategory` enum in `src/notifications/entities/notification.entity.ts`:

```typescript
export enum NotificationCategory {
  // ... existing types ...
  CUSTOM_TYPE = 'custom_type',
}
```

2. Create default preferences in `PreferencesService.createDefaultPreferences()`:

```typescript
categoryPreferences: {
  // ... existing ...
  customType: { email: true, push: true, inApp: true, sms: false },
}
```

3. Use in your code:

```typescript
await this.notificationsService.createAndSendNotification({
  userId,
  type: NotificationType.IN_APP,
  category: NotificationCategory.CUSTOM_TYPE,
  title: 'Custom Notification',
  message: 'Your custom message'
});
```

### Creating a Template

```bash
curl -X POST http://localhost:3000/notifications/templates \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "welcome_v1",
    "name": "Welcome Email",
    "description": "Sent when new user joins",
    "category": "system_alert",
    "emailSubject": "Welcome to Gatheraa, {{firstName}}!",
    "emailTemplate": "<h1>Welcome {{firstName}}</h1><p>We are excited to have you.</p>",
    "pushTitle": "Welcome!",
    "pushMessage": "Welcome to Gatheraa, {{firstName}}",
    "inAppTitle": "Welcome",
    "inAppMessage": "Welcome to the Gatheraa community!",
    "variables": ["firstName"]
  }'
```

### Using a Template

```typescript
const notification = await this.notificationsService.createAndSendNotification({
  userId,
  type: NotificationType.EMAIL,
  category: NotificationCategory.SYSTEM_ALERT,
  title: 'Welcome Email',
  message: 'Welcome to Gatheraa',
  templateId: 'welcome_v1', // Uses welcome_v1 template
  data: {
    firstName: 'John'
  },
  sendImmediately: true
});
```

## Troubleshooting

### WebSocket Connection Failed

**Problem**: WebSocket connection times out or fails

**Solutions**:
1. Check JWT token is valid:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/auth/verify
   ```

2. Check CORS settings in `main.ts`

3. Check Socket.IO is listening:
   ```bash
   curl http://localhost:3000/socket.io/?EIO=4&transport=polling
   ```

### Notifications Not Being Sent

**Problem**: Notifications created but not visible

**Solutions**:
1. Check user preferences are enabled:
   ```bash
   curl -H "Authorization: Bearer TOKEN" http://localhost:3000/notifications/preferences/me
   ```

2. Check Redis connection:
   ```bash
   redis-cli ping
   # Should return PONG
   ```

3. Check email provider credentials in `.env`

4. Review logs for errors:
   ```bash
   npm run start:dev 2>&1 | grep -i notification
   ```

### Rate Limit Errors

**Problem**: Getting "Rate limit exceeded" errors

**Solutions**:
1. Temporarily increase rate limit in `NotificationsService`:
   ```typescript
   private readonly DEFAULT_RATE_LIMIT = 100; // Increase from 100
   ```

2. Or wait 1 hour for the rate limit window to reset

### Email Not Sending

**Problem**: Email notifications stuck in queue

**Solutions**:
1. Verify SMTP credentials:
   ```bash
   NODE_ENV=test npx nodemailer-tester \
     -h smtp.gmail.com -p 587 -u email@gmail.com -p password
   ```

2. Enable "Less secure app access" for Gmail
3. Check email address is verified in preferences
4. Review email provider logs

## Next Steps

1. **Review Documentation**: Read [NOTIFICATIONS_README.md](./NOTIFICATIONS_README.md)
2. **Run Tests**: Execute `npm test -- notifications`
3. **Integrate**: Add notification calls to your business logic
4. **Configure**: Set up Firebase and email credentials
5. **Deploy**: Follow your deployment process to push to production

## Support

For detailed API documentation, see: `docs/NOTIFICATIONS_README.md`
For architecture details, see: `NOTIFICATION_IMPLEMENTATION_SUMMARY.md`
For code examples, see: `test/notifications.integration.spec.ts`

## Performance Tips

1. **Batch Notifications**: Use `sendBulkNotifications` for multiple users
2. **Schedule Deliveries**: Use `scheduledFor` for non-urgent notifications
3. **Cache Preferences**: User preferences are cached for 1 hour
4. **Index Queries**: Use category/status filters to reduce result sets
5. **Archive Old**: Consider archiving notifications older than 30 days

Happy notifying! 🎉
