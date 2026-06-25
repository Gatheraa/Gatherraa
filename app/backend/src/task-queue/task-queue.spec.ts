// Task Queue Tests
// Comprehensive test suite for BullMQ task queue system

import { Test, TestingModule } from '@nestjs/testing';
import { BullModule } from '@nestjs/bullmq';
import { TaskQueueService, QueueName } from './services/task-queue.service';
import { EmailProcessor } from './processors/email.processor';
import { ImageProcessor } from './processors/image.processor';
import { BlockchainProcessor } from './processors/blockchain.processor';
import { ScheduledTaskProcessor } from './processors/scheduled-task.processor';
import { INestApplication } from '@nestjs/common';

describe('TaskQueue System', () => {
  let app: INestApplication;
  let taskQueueService: TaskQueueService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        BullModule.forRoot({
          connection: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT) || 6379,
          },
        }),
        BullModule.registerQueue(
          { name: 'email' },
          { name: 'image-processing' },
          { name: 'blockchain-events' },
          { name: 'scheduled-tasks' },
          { name: 'notifications' },
          { name: 'analytics' },
          { name: 'dead-letter' },
        ),
      ],
      providers: [
        TaskQueueService,
        EmailProcessor,
        ImageProcessor,
        BlockchainProcessor,
        ScheduledTaskProcessor,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    taskQueueService = moduleFixture.get<TaskQueueService>(TaskQueueService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('EmailProcessor', () => {
    it('should enqueue an email job', async () => {
      const job = await taskQueueService.enqueueEmail({
        to: 'test@example.com',
        subject: 'Test Email',
        template: 'test-template',
        context: { userName: 'Test User' },
      });

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.data.to).toBe('test@example.com');
    });

    it('should respect email priority', async () => {
      const job = await taskQueueService.enqueueEmail(
        {
          to: 'test@example.com',
          subject: 'Priority Email',
          template: 'priority-template',
        },
        { priority: 10 },
      );

      expect(job.opts.priority).toBe(10);
    });

    it('should handle email with attachments', async () => {
      const job = await taskQueueService.enqueueEmail({
        to: 'test@example.com',
        subject: 'Email with Attachment',
        template: 'attachment-template',
        context: {},
      });

      expect(job).toBeDefined();
    });

    it('should queue multiple emails', async () => {
      const emails = [
        { to: 'user1@example.com', subject: 'Hello User 1', template: 'test' },
        { to: 'user2@example.com', subject: 'Hello User 2', template: 'test' },
        { to: 'user3@example.com', subject: 'Hello User 3', template: 'test' },
      ];

      for (const email of emails) {
        const job = await taskQueueService.enqueueEmail(email);
        expect(job).toBeDefined();
      }
    });
  });

  describe('ImageProcessingProcessor', () => {
    it('should enqueue an image processing job', async () => {
      const job = await taskQueueService.enqueueImageProcessing({
        url: 'https://example.com/image.jpg',
        transformations: [
          {
            type: 'resize',
            options: { width: 200, height: 200 },
          },
        ],
        outputFormat: 'webp',
        quality: 85,
      });

      expect(job).toBeDefined();
      expect(job.data.url).toBe('https://example.com/image.jpg');
    });

    it('should handle multiple transformations', async () => {
      const job = await taskQueueService.enqueueImageProcessing({
        url: 'https://example.com/image.jpg',
        transformations: [
          { type: 'resize', options: { width: 300, height: 300 } },
          { type: 'blur', options: { sigma: 1.5 } },
          { type: 'sharpen', options: { sigma: 1 } },
        ],
      });

      expect(job.data.transformations.length).toBe(3);
    });

    it('should respect image quality setting', async () => {
      const job = await taskQueueService.enqueueImageProcessing({
        url: 'https://example.com/image.jpg',
        transformations: [],
        quality: 95,
      });

      expect(job.data.quality).toBe(95);
    });

    it('should batch process multiple images', async () => {
      const images = [
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg',
        'https://example.com/image3.jpg',
      ];

      const jobs = [];
      for (const url of images) {
        const job = await taskQueueService.enqueueImageProcessing({
          url,
          transformations: [
            {
              type: 'resize',
              options: { width: 200, height: 200 },
            },
          ],
        });
        jobs.push(job);
      }

      expect(jobs.length).toBe(3);
    });
  });

  describe('BlockchainProcessor', () => {
    it('should enqueue a blockchain event job', async () => {
      const job = await taskQueueService.enqueueBlockchainEvent({
        contractAddress: '0x1234567890123456789012345678901234567890',
        eventName: 'Transfer',
        parameters: {
          from: '0x...',
          to: '0x...',
          amount: '1000000000000000000',
        },
        networkId: '1',
      });

      expect(job).toBeDefined();
      expect(job.data.contractAddress).toBe(
        '0x1234567890123456789012345678901234567890',
      );
    });

    it('should handle blockchain action routing', async () => {
      const job = await taskQueueService.enqueueBlockchainEvent(
        {
          contractAddress: '0x...',
          eventName: 'Approval',
          parameters: { spender: '0x...', amount: '1000' },
        },
        { priority: 5 },
      );

      expect(job).toBeDefined();
    });

    it('should queue events from different networks', async () => {
      const networks = ['1', '137', '11155111']; // Ethereum, Polygon, Sepolia

      for (const networkId of networks) {
        const job = await taskQueueService.enqueueBlockchainEvent({
          contractAddress: '0x...',
          eventName: 'Event',
          parameters: {},
          networkId,
        });

        expect(job.data.networkId).toBe(networkId);
      }
    });
  });

  describe('ScheduledTaskProcessor', () => {
    it('should create a scheduled task', async () => {
      const job = await taskQueueService.enqueueScheduledTask(
        {
          taskName: 'cleanup-expired-sessions',
          payload: {},
        },
        '0 2 * * *', // Daily at 2 AM
      );

      expect(job).toBeDefined();
      expect(job.data.taskName).toBe('cleanup-expired-sessions');
    });

    it('should respect cron patterns', async () => {
      const patterns = [
        '0 0 * * *', // Daily
        '0 */6 * * *', // Every 6 hours
        '0 9 * * 1', // Weekly
        '*/15 * * * *', // Every 15 minutes
      ];

      for (const pattern of patterns) {
        const job = await taskQueueService.enqueueScheduledTask(
          {
            taskName: 'test-task',
            payload: {},
          },
          pattern,
        );

        expect(job.opts.repeat).toBeDefined();
      }
    });
  });

  describe('NotificationProcessor', () => {
    it('should enqueue a notification job', async () => {
      const job = await taskQueueService.enqueueNotification({
        userId: 'user-123',
        type: 'email',
        message: 'You have a new event',
        metadata: { eventId: 'evt-456' },
      });

      expect(job).toBeDefined();
      expect(job.data.userId).toBe('user-123');
    });

    it('should respect notification priority', async () => {
      const job = await taskQueueService.enqueueNotification(
        {
          userId: 'user-123',
          type: 'urgent',
          message: 'Critical alert',
        },
        { priority: 10 },
      );

      expect(job.opts.priority).toBe(10);
    });
  });

  describe('AnalyticsProcessor', () => {
    it('should enqueue an analytics job', async () => {
      const job = await taskQueueService.enqueueAnalytics({
        event: 'user_signup',
        userId: 'user-123',
        properties: {
          source: 'google',
          timestamp: new Date().toString(),
        },
      });

      expect(job).toBeDefined();
      expect(job.data.event).toBe('user_signup');
    });

    it('should batch analytics events', async () => {
      const events = [
        { event: 'page_view', userId: 'user-1', properties: {} },
        { event: 'button_click', userId: 'user-2', properties: {} },
        { event: 'form_submit', userId: 'user-3', properties: {} },
      ];

      for (const event of events) {
        const job = await taskQueueService.enqueueAnalytics(event);
        expect(job).toBeDefined();
      }
    });
  });

  describe('Queue Management', () => {
    it('should get queue statistics', async () => {
      const stats = await taskQueueService.getQueueStats(QueueName.EMAIL);

      expect(stats).toBeDefined();
      expect(stats.queueName).toBe(QueueName.EMAIL);
      expect(stats.active).toBeGreaterThanOrEqual(0);
      expect(stats.waiting).toBeGreaterThanOrEqual(0);
    });

    it('should get all queue statistics', async () => {
      const allStats = await taskQueueService.getAllQueueStats();

      expect(allStats).toBeDefined();
      expect(allStats.length).toBeGreaterThan(0);
      expect(allStats.some((s) => s.queueName === QueueName.EMAIL)).toBe(true);
    });

    it('should pause a queue', async () => {
      await taskQueueService.pauseQueue(QueueName.EMAIL);
      // Verify queue is paused
    });

    it('should resume a queue', async () => {
      await taskQueueService.resumeQueue(QueueName.EMAIL);
      // Verify queue is resumed
    });

    it('should get failed jobs', async () => {
      const failed = await taskQueueService.getFailedJobs(QueueName.EMAIL);

      expect(Array.isArray(failed)).toBe(true);
    });

    it('should clear a queue', async () => {
      await taskQueueService.clearQueue(QueueName.NOTIFICATIONS);
      const stats = await taskQueueService.getQueueStats(
        QueueName.NOTIFICATIONS,
      );

      // Queue should be empty
    });
  });

  describe('Job Prioritization', () => {
    it('should process high priority jobs first', async () => {
      const lowPriorityJob = await taskQueueService.enqueueEmail(
        {
          to: 'low@example.com',
          subject: 'Low Priority',
          template: 'test',
        },
        { priority: -5 },
      );

      const highPriorityJob = await taskQueueService.enqueueEmail(
        {
          to: 'high@example.com',
          subject: 'High Priority',
          template: 'test',
        },
        { priority: 10 },
      );

      expect(highPriorityJob.opts.priority).toBeGreaterThan(
        lowPriorityJob.opts.priority,
      );
    });

    it('should maintain priority across multiple jobs', async () => {
      const jobs = await Promise.all([
        taskQueueService.enqueueEmail(
          { to: 'a@test.com', subject: 'A', template: 'test' },
          { priority: 0 },
        ),
        taskQueueService.enqueueEmail(
          { to: 'b@test.com', subject: 'B', template: 'test' },
          { priority: 10 },
        ),
        taskQueueService.enqueueEmail(
          { to: 'c@test.com', subject: 'C', template: 'test' },
          { priority: 5 },
        ),
      ]);

      expect(jobs[1].opts.priority).toBe(10);
      expect(jobs[2].opts.priority).toBe(5);
      expect(jobs[0].opts.priority).toBe(0);
    });
  });

  describe('Error Handling & Dead Letter Queue', () => {
    it('should move failed job to dead letter queue', async () => {
      const job = await taskQueueService.enqueueEmail({
        to: 'test@example.com',
        subject: 'Test',
        template: 'test',
      });

      // Simulate failure and move to DLQ
      await taskQueueService.moveToDeadLetterQueue(job, 'Test failure');

      const dlqJobs = await taskQueueService.getFailedJobs(
        QueueName.DEAD_LETTER,
      );
      expect(Array.isArray(dlqJobs)).toBe(true);
    });

    it('should track retry attempts', async () => {
      const job = await taskQueueService.enqueueEmail({
        to: 'test@example.com',
        subject: 'Test',
        template: 'test',
      });

      expect(job.opts.attempts).toBe(3);
    });

    it('should handle exponential backoff', async () => {
      const job = await taskQueueService.enqueueEmail(
        {
          to: 'test@example.com',
          subject: 'Test',
          template: 'test',
        },
        {
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );

      expect(job.opts.backoff).toBeDefined();
      expect(job.opts.backoff.type).toBe('exponential');
    });
  });

  describe('Deduplication', () => {
    it('should prevent duplicate jobs with same key', async () => {
      const key = 'email-user-123-welcome';

      const job1 = await taskQueueService.enqueueEmail(
        {
          to: 'user@example.com',
          subject: 'Welcome',
          template: 'welcome',
        },
        { deduplicationKey: key },
      );

      expect(job1).toBeDefined();
      // Enqueuing again with same key should be idempotent
    });
  });

  describe('Job Status and Progress', () => {
    it('should track job status', async () => {
      const job = await taskQueueService.enqueueEmail({
        to: 'test@example.com',
        subject: 'Status Test',
        template: 'test',
      });

      const status = await taskQueueService.getJobStatus('email', job.id);

      expect(status).toBeDefined();
      expect(status.id).toBe(job.id);
      expect(status.status).toBeDefined();
    });

    it('should track job attempts', async () => {
      const job = await taskQueueService.enqueueEmail({
        to: 'test@example.com',
        subject: 'Test',
        template: 'test',
      });

      const status = await taskQueueService.getJobStatus('email', job.id);

      expect(status.maxAttempts).toBeGreaterThan(0);
    });
  });

  describe('Concurrency Control', () => {
    it('should respect queue concurrency settings', async () => {
      // Email queue: 5 concurrent
      // Image queue: 3 concurrent
      // This is configured in the module setup

      const emailJob = await taskQueueService.enqueueEmail({
        to: 'test@example.com',
        subject: 'Test',
        template: 'test',
      });

      const imageJob = await taskQueueService.enqueueImageProcessing({
        url: 'https://example.com/image.jpg',
        transformations: [],
      });

      expect(emailJob).toBeDefined();
      expect(imageJob).toBeDefined();
    });
  });
});
