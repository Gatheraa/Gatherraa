import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksService } from './webhooks.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { WebhookDeliveryAttempt } from './entities/webhook-delivery-attempt.entity';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { ForbiddenException } from '@nestjs/common';

describe('WebhooksService', () => {
    let service: WebhooksService;
    let webhookRepo: any;
    let attemptRepo: any;
    let httpService: any;

    const mockWebhook = {
        id: 'webhook-1',
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        secret: 'secret-1',
        events: ['event.created'],
        version: 'v1',
        ownerId: 'user-1',
        isActive: true,
    };

    beforeEach(async () => {
        webhookRepo = {
            create: jest.fn().mockImplementation((dto) => dto),
            save: jest.fn().mockResolvedValue(mockWebhook),
            findAndCount: jest.fn().mockResolvedValue([[mockWebhook], 1]),
            findOne: jest.fn().mockResolvedValue(mockWebhook),
            remove: jest.fn().mockResolvedValue(mockWebhook),
        };

        attemptRepo = {
            create: jest.fn().mockImplementation((dto) => dto),
            save: jest.fn().mockImplementation((dto) => Promise.resolve({ id: 'attempt-1', ...dto })),
            findAndCount: jest.fn().mockResolvedValue([[], 0]),
            countBy: jest.fn().mockResolvedValue(0),
            createQueryBuilder: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnThis(),
                addSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                groupBy: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({ avgDuration: 100 }),
                getRawMany: jest.fn().mockResolvedValue([]),
            }),
        };

        httpService = {
            post: jest.fn().mockReturnValue(of({ status: 200, data: { success: true } })),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WebhooksService,
                { provide: getRepositoryToken(WebhookSubscription), useValue: webhookRepo },
                { provide: getRepositoryToken(WebhookDeliveryAttempt), useValue: attemptRepo },
                { provide: HttpService, useValue: httpService },
            ],
        }).compile();

        service = module.get<WebhooksService>(WebhooksService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('createWebhook', () => {
        it('should generate a unique secret', async () => {
            const dto = { name: 'Test', url: 'http://test.com', events: ['*'] as any };
            const result1 = await service.createWebhook('user-1', dto as any);
            const result2 = await service.createWebhook('user-1', dto as any);
            expect(result1.secret).toBeDefined();
            expect(result1.secret).not.toEqual(result2.secret);
        });
    });

    describe('findOneWebhook', () => {
        it('should throw ForbiddenException if ownerId does not match', async () => {
            webhookRepo.findOne.mockResolvedValue({ ...mockWebhook, ownerId: 'other-user' });
            await expect(service.findOneWebhook('webhook-1', 'user-1')).rejects.toThrow(ForbiddenException);
        });
    });

    describe('deliverPayload', () => {
        it('should sign the payload correctly', async () => {
            const webhook = { secret: 'test-secret', url: 'http://test.com', version: 'v1' };
            const payload = { data: 'test' };

            await service.deliverPayload(webhook, 'test.event', payload, 1);

            const lastCall = httpService.post.mock.calls[0];
            const signature = lastCall[2].headers['X-Gatherraa-Signature'];
            expect(signature).toBeDefined();
            expect(signature.length).toBe(64); // SHA256 hex length
        });
    });

    describe('rotateSecret', () => {
        it('should change the secret', async () => {
            const oldSecret = mockWebhook.secret;
            const result = await service.rotateSecret('webhook-1', 'user-1');
            expect(result.secret).not.toEqual(oldSecret);
            expect(webhookRepo.save).toHaveBeenCalled();
        });
    });
});
