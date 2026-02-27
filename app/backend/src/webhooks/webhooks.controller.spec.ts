import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';

describe('WebhooksController', () => {
    let controller: WebhooksController;
    let service: any;

    const mockUser = { id: 'user-1', email: 'test@example.com' };
    const mockWebhook = { id: 'webhook-1', name: 'Test' };

    beforeEach(async () => {
        service = {
            createWebhook: jest.fn().mockResolvedValue(mockWebhook),
            findAllWebhooks: jest.fn().mockResolvedValue({ items: [mockWebhook], total: 1 }),
            findOneWebhook: jest.fn().mockResolvedValue(mockWebhook),
            updateWebhook: jest.fn().mockResolvedValue(mockWebhook),
            deleteWebhook: jest.fn().mockResolvedValue(mockWebhook),
            rotateSecret: jest.fn().mockResolvedValue({ secret: 'new-secret' }),
            testWebhook: jest.fn().mockResolvedValue({ success: true }),
            getAnalytics: jest.fn().mockResolvedValue({ stats: {} }),
            getDeliveries: jest.fn().mockResolvedValue({ items: [], total: 0 }),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [WebhooksController],
            providers: [
                { provide: WebhooksService, useValue: service },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: (context: ExecutionContext) => true })
            .compile();

        controller = module.get<WebhooksController>(WebhooksController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('create', () => {
        it('should call service.createWebhook', async () => {
            const dto = { name: 'Test', url: 'http://test.com', events: ['*'] as any };
            await controller.create(mockUser as any, dto);
            expect(service.createWebhook).toHaveBeenCalledWith(mockUser.id, dto);
        });
    });

    describe('findAll', () => {
        it('should call service.findAllWebhooks', async () => {
            await controller.findAll(mockUser as any, 1, 20);
            expect(service.findAllWebhooks).toHaveBeenCalledWith(mockUser.id, 1, 20);
        });
    });
});
