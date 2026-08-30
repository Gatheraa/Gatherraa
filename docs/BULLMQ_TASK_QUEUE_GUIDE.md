<!-- BullMQ Task Queue Implementation -->

# BullMQ Distributed Task Queue System

## Overview

A comprehensive distributed task queue system using BullMQ with Redis for background job processing in the Gatherraa application. Supports email sending, image processing, blockchain event handling, and scheduled tasks with advanced features like retry logic, dead letter queues, job prioritization, and progress tracking.

## Architecture

### System Design

```
┌─────────────────────────────────────────────────────────────┐
│                  Gatherraa Application                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Controllers → Services → TaskQueueService                  │
│                                      ↓                       │
│                            BullMQ Queues                     │
│                            (in Redis)                        │
│                                      ↓                       │
│    ┌─────────────────────────────────────────────────────┐  │
│    │    Queue Processors (Concurrency Controlled)         │  │
│    │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │  │
│    │  │ Email (5)    │  │ Image (3)    │  │Blockchain│  │  │
│    │  └──────────────┘  └──────────────┘  └──────────┘  │  │
│    │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │  │
│    │  │Notification  │  │Analytics     │  │ Scheduled│  │  │
│    │  └──────────────┘  └──────────────┘  └──────────┘  │  │
│    └─────────────────────────────────────────────────────┘  │
│                                      ↓                       │
│                     ┌──────────────────────┐               │
│                     │  Dead Letter Queue   │               │
│                     │  (Failed Jobs)       │               │
│                     └──────────────────────┘               │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  Bull Board Monitoring Dashboard (http://localhost:3000/   │
│  admin/queues)                                             │
└─────────────────────────────────────────────────────────────┘

Redis Backend
  └─ Persistent storage for job state
  └─ Pub/Sub for inter-process communication
  └- Rate limiting and throttling
```

### Components

| Component | Purpose | Details |
|-----------|---------|---------|
| **TaskQueueService** | Central queue management | Enqueue, status, cleanup, stats |
| **EmailProcessor** | Email sending | Nodemailer integration, templates |
| **ImageProcessor** | Image transformation | Sharp library for image ops |
| **BlockchainProcessor** | Web3 interactions | Event processing and indexing |
| **ScheduledTaskProcessor** | Recurring tasks | Cron-based scheduling |
| **TaskQueueController** | REST API | Queue management endpoints |
| **Bull Board** | Monitoring UI | Real-time queue visualization |

## Features

### 1. Multiple Queue Types

```typescript
// Queue Names
- email              // Email sending
- image-processing   // Image transformations
- blockchain-events  // Web3 event handling
- scheduled-tasks    // Cron-based tasks
- notifications      // Push/email notifications
- analytics          // Event analytics
- dead-letter        // Failed jobs
```

### 2. Job Prioritization

```typescript
// Priority levels (higher = earlier execution)
const priority = {
  critical: 10,     // System alerts, critical notifications
  high: 5,          // User-facing operations
  normal: 0,        // Default priority
  low: -5,          // Analytics, background tasks
  deferred: -10,    // Can be delayed significantly
};

// Usage
await taskQueueService.enqueueEmail(data, { priority: 10 });
```

### 3. Retry Logic with Exponential Backoff

```typescript
// Default retry configuration
{
  attempts: 3,        // Retry up to 3 times
  backoff: {
    type: 'exponential',
    delay: 2000,      // Start with 2 second delay
                      // Exponentially increases: 2s → 4s → 8s
  }
}

// Custom retry strategies per queue:
- Email: 3 attempts, 2s initial delay (important but can retry)
- Image: 3 attempts, 2s initial delay (resilient operations)
- Blockchain: 5 attempts, 3s initial delay (rate limits possible)
- Analytics: 2 attempts, 1s initial delay (low priority)
```

### 4. Dead Letter Queue (DLQ)

```typescript
// Flow on final failure
Job → (attempt 1) → failure
   → (attempt 2) → failure
   → (attempt 3) → failure
   → Dead Letter Queue

// DLQ contains:
- Original job data
- Failure reason and stack trace
- Number of attempts made
- Original queue name
- Timestamp of failure

// Manual recovery
const dlqJobs = await taskQueueService.getFailedJobs('dead-letter');
// Review and decide to retry or discard
```

### 5. Progress Tracking

```typescript
// Processors update progress during execution
@Process()
async handleJob(job: Job) {
  await job.updateProgress(10);   // 10% complete
  // ... do work ...
  await job.updateProgress(50);   // 50% complete
  // ... do more work ...
  await job.updateProgress(100);  // 100% complete
}

// Client can check progress
const status = await taskQueueService.getJobStatus('email', jobId);
console.log(status.progress);  // 0-100
```

### 6. Scheduled/Recurring Tasks

```typescript
// Using cron patterns
await taskQueueService.enqueueScheduledTask(
  {
    taskName: 'cleanup-expired-sessions',
    payload: { maxAge: 7 * 24 * 60 * 60 * 1000 }
  },
  '0 2 * * *'  // 2 AM daily
);

// Common patterns
'0 0 * * *'      // Daily at midnight
'0 */6 * * *'    // Every 6 hours
'0 9 * * 1'      // Every Monday at 9 AM
'*/15 * * * *'   // Every 15 minutes
```

### 7. Job Deduplication

```typescript
// Prevent duplicate jobs
await taskQueueService.enqueueEmail(data, {
  deduplicationKey: `email-${userId}-welcome`
});

// If same key enqueued within time window, skips duplicate
```

## API Endpoints

### Job Enqueueing

```
POST /api/task-queue/email
  Body: {
    to: string
    subject: string
    template: string
    context?: object
    priority?: number
    delay?: number
  }
  Returns: { success, jobId, queueName, timestamp }

POST /api/task-queue/image-processing
  Body: {
    url: string
    transformations: array
    outputFormat?: string
    quality?: number
    priority?: number
  }
  Returns: { success, jobId, queueName, timestamp }

POST /api/task-queue/blockchain-event
  Body: {
    contractAddress: string
    eventName: string
    parameters: object
    networkId?: string
    priority?: number
  }
  Returns: { success, jobId, queueName, timestamp }

POST /api/task-queue/notification
  Body: {
    userId: string
    type: string
    message: string
    metadata?: object
    priority?: number
  }
  Returns: { success, jobId, queueName, timestamp }
```

### Job Management

```
GET /api/task-queue/status/:queueName/:jobId
  Returns: { found, job: { id, status, progress, attempts, ... } }

GET /api/task-queue/stats?queueName=email
  Returns: { stats: [{ queueName, active, waiting, completed, failed, ... }] }

GET /api/task-queue/stats
  Returns: All queue statistics

GET /api/task-queue/:queueName/failed?start=0&end=10
  Returns: { queueName, count, jobs: [...] }

POST /api/task-queue/:queueName/pause
  Returns: { success, message, timestamp }

POST /api/task-queue/:queueName/resume
  Returns: { success, message, timestamp }

POST /api/task-queue/:queueName/clear
  Returns: { success, message, timestamp }

POST /api/task-queue/:queueName/retry/:jobId
  Returns: { success, jobId, message, timestamp }

POST /api/task-queue/:queueName/remove/:jobId
  Returns: { success, message, timestamp }

GET /api/task-queue/health
  Returns: { status, summary: { activeJobs, failedJobs, ... }, details: [...] }
```

## Monitoring Dashboard

### Bull Board Setup

Access at: `http://localhost:3000/admin/queues`

**Features:**
- Real-time queue statistics
- Job details and history
- Progress visualization
- Failure analysis
- Manual job management (pause, resume, remove)

### Dashboard Views

1. **Queues Overview**
   - Active jobs count
   - Waiting jobs
   - Completed jobs
   - Failed jobs
   - Delayed jobs

2. **Queue Details**
   - Individual queue statistics
   - Job list with filters
   - Job details panel
   - Progress bar
   - Error messages

3. **Job Management**
   - Pause/Resume individual queues
   - Manual job retry
   - Job removal
   - Clear queue

## Usage Examples

### Email Sending

```typescript
import { TaskQueueService } from './task-queue/services/task-queue.service';

@Injectable()
export class UserService {
  constructor(private taskQueue: TaskQueueService) {}

  async sendWelcomeEmail(user: User) {
    await this.taskQueue.enqueueEmail(
      {
        to: user.email,
        subject: 'Welcome to Gatherraa!',
        template: 'welcome-email.hbs',
        context: {
          userName: user.name,
          activationLink: `https://gatherraa.com/activate/${user.token}`
        }
      },
      { priority: 10 }  // High priority
    );
  }
}
```

### Image Processing

```typescript
async processUserAvatar(userId: string, uploadUrl: string) {
  const job = await this.taskQueue.enqueueImageProcessing(
    {
      url: uploadUrl,
      transformations: [
        {
          type: 'resize',
          options: { width: 200, height: 200, fit: 'cover' }
        },
        {
          type: 'webp',
          options: { quality: 85 }
        }
      ],
      outputFormat: 'webp',
      quality: 85
    },
    { deduplicationKey: `avatar-${userId}` }
  );
}
```

### Blockchain Event Handling

```typescript
async handleTicketAllocation(eventData: any) {
  await this.taskQueue.enqueueBlockchainEvent(
    {
      contractAddress: '0x...',
      eventName: 'TicketAllocated',
      parameters: {
        winner: eventData.winner,
        transactionHash: eventData.txHash
      },
      networkId: '1',  // Ethereum Mainnet
      action: 'index'
    },
    { priority: 5 }  // Normal priority
  );
}
```

### Scheduled Tasks

```typescript
// Daily session cleanup at 2 AM UTC
await this.taskQueue.enqueueScheduledTask(
  {
    taskName: 'cleanup-expired-sessions',
    payload: { maxAge: 30 * 24 * 60 * 60 * 1000 }
  },
  '0 2 * * *'
);

// Weekly report generation every Monday at 9 AM
await this.taskQueue.enqueueScheduledTask(
  {
    taskName: 'generate-weekly-reports',
    payload: { format: 'pdf' }
  },
  '0 9 * * 1'
);

// Every 15 minutes: cache refresh
await this.taskQueue.enqueueScheduledTask(
  {
    taskName: 'refresh-cache',
    payload: { includeHotData: true }
  },
  '*/15 * * * *'
);
```

### Monitoring Queue Health

```typescript
// Check system health
const health = await fetch('/api/task-queue/health');
const { status, summary } = await health.json();

console.log(`System Status: ${status}`);
console.log(`Active Jobs: ${summary.activeJobs}`);
console.log(`Failed Jobs: ${summary.failedJobs}`);
console.log(`Waiting Jobs: ${summary.waitingJobs}`);

// Get specific queue stats
const stats = await fetch('/api/task-queue/stats?queueName=email');
const { stats: emailStats } = await stats.json();

console.log(`Email Queue: ${emailStats[0].active} active, ${emailStats[0].failed} failed`);
```

## Error Handling & Recovery

### Automatic Retry

```
Initial Attempt
  ↓ (failure)
Retry 1 (wait 2s)
  ↓ (failure)
Retry 2 (wait 4s)
  ↓ (failure)
Retry 3 (wait 8s)
  ↓ (final failure)
Dead Letter Queue
```

### Manual Recovery

```typescript
// List failed jobs
const failedJobs = await taskQueueService.getFailedJobs('email');

// Retry a specific job
await taskQueueService.retryFailedJob('email', jobId);

// Or remove it permanently
await taskQueueService.removeJob('email', jobId);
```

## Performance Considerations

### Concurrency Settings

```
Queue              Concurrency    Use Case
─────────────────────────────────────────────
Email              5              Moderate volume
Image Processing   3              CPU-intensive
Blockchain         5              Network I/O
Notifications      5              Time-sensitive
Analytics          2              Can be delayed
```

### Storage Optimization

```typescript
// Job cleanup settings (in task-queue.module.ts)
removeOnComplete: {
  age: 3600  // Keep completed jobs for 1 hour
},
removeOnFail: false  // Keep failed jobs for analysis

// Manual cleanup
await taskQueueService.clearQueue('analytics');
```

### Scaling Strategies

1. **Horizontal Scaling**
   - Multiple application instances share Redis
   - Workers process jobs in parallel
   - No single point of failure

2. **Queue Isolation**
   - Separate queues by operation type
   - Different concurrency for different queues
   - Prioritized processing

3. **Redis Optimization**
   - Use Redis Cluster for high volume
   - Persistence enabled for reliability
   - Monitor memory usage

## Troubleshooting

### Queue Not Processing Jobs

```
Check:
1. Redis connection (redis-cli PING)
2. Queue is not paused
3. No workers running (check concurrency)
4. Check logs for entry errors
```

### High Memory Usage

```
Solutions:
1. Reduce job retention time
2. Increase cleanup frequency
3. Process jobs in smaller batches
4. Archive old data
```

### Job Processing Timeouts

```
Fix:
1. Increase timeout in processor
2. Split large jobs into smaller ones
3. Optimize processor logic
4. Check system resources (CPU, disk, network)
```

### Dead Letter Queue Growing

```
Actions:
1. Investigate failure reasons
2. Fix underlying issues
3. Retry from DLQ
4. Archive to storage
```

## Environment Variables

```bash
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Email Configuration (for email processor)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@gatherraa.com

# Blockchain RPC Endpoints
ETH_MAINNET_RPC=https://eth-mainnet.g.alchemy.com/v2/key
ETH_SEPOLIA_RPC=https://eth-sepolia.g.alchemy.com/v2/key
POLYGON_RPC=https://polygon-rpc.com

# BullMQ Settings
BULLMQ_CONCURRENCY_EMAIL=5
BULLMQ_CONCURRENCY_IMAGE=3
BULLMQ_MAX_ATTEMPTS=3
BULLMQ_BACKOFF_DELAY=2000

# Blockchain Event Queue Resource Limits
# Jobs exceeding these limits are rejected as permanent input failures
# (never retried) at every ingestion entry point.
BLOCKCHAIN_MAX_PAYLOAD_BYTES=65536   # Max serialized job payload (64 KiB)
BLOCKCHAIN_MAX_BATCH_SIZE=100        # Max events/logs/batch items per job

# Bull Board UI
BULL_BOARD_ENABLED=true
BULL_BOARD_PATH=/admin/queues
```

## Security

### Access Control

```typescript
// Add authentication to Bull Board
@Get(':queueName/failed')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin', 'operator')
async getFailedJobs(...) {
  // Only authenticated admin/operator users
}
```

### Data Protection

- Sensitive data not logged
- Credentials never stored in Redis
- Job data encrypted in transit (TLS)
- API endpoints behind authentication

## Testing

### Unit Tests

```typescript
describe('TaskQueueService', () => {
  it('should enqueue email job', async () => {
    const job = await service.enqueueEmail({
      to: 'test@example.com',
      subject: 'Test',
      template: 'test'
    });
    expect(job.id).toBeDefined();
  });

  it('should track job progress', async () => {
    const status = await service.getJobStatus('email', jobId);
    expect(status.progress).toBe(50);
  });
});
```

## References

- [BullMQ Documentation](https://docs.bullmq.io/)
- [Bull Board](https://github.com/felixmosh/bull-board)
- [NestJS BullMQ Integration](https://docs.nestjs.com/techniques/queues)
- [Redis Documentation](https://redis.io/docs/)

---

**Status**: Production Ready  
**Last Updated**: February 2026  
**Version**: 1.0.0
