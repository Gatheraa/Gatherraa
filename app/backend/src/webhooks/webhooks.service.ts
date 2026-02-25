import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { WebhookDeliveryAttempt } from './entities/webhook-delivery-attempt.entity';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { WebhookEventType } from './constants/webhook-events.constant';
import * as crypto from 'crypto';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { WebhookPayloadBuilder } from './versioning/webhook-payload.builder';

@Injectable()
export class WebhooksService {
    private readonly logger = new Logger(WebhooksService.name);

    constructor(
        @InjectRepository(WebhookSubscription)
        private readonly webhookRepository: Repository<WebhookSubscription>,
        @InjectRepository(WebhookDeliveryAttempt)
        private readonly attemptRepository: Repository<WebhookDeliveryAttempt>,
        private readonly httpService: HttpService,
    ) { }

    async createWebhook(ownerId: string, dto: CreateWebhookDto) {
        const secret = crypto.randomBytes(32).toString('hex');
        const webhook = this.webhookRepository.create({
            ...dto,
            ownerId,
            secret,
        });
        const saved = await this.webhookRepository.save(webhook);
        // Secret is returned only on creation — store it securely, it cannot be retrieved again
        return { ...saved, secret };
    }

    async findAllWebhooks(ownerId: string, page = 1, limit = 20) {
        const [items, total] = await this.webhookRepository.findAndCount({
            where: { ownerId },
            take: limit,
            skip: (page - 1) * limit,
            order: { createdAt: 'DESC' },
        });
        return { items, total };
    }

    async findOneWebhook(id: string, ownerId: string) {
        const webhook = await this.webhookRepository.findOne({ where: { id } });
        if (!webhook) throw new NotFoundException('Webhook not found');
        if (webhook.ownerId !== ownerId) throw new ForbiddenException();
        return webhook;
    }

    async updateWebhook(id: string, ownerId: string, dto: UpdateWebhookDto) {
        const webhook = await this.findOneWebhook(id, ownerId);
        Object.assign(webhook, dto);
        return await this.webhookRepository.save(webhook);
    }

    async deleteWebhook(id: string, ownerId: string) {
        const webhook = await this.findOneWebhook(id, ownerId);
        return await this.webhookRepository.remove(webhook);
    }

    async rotateSecret(id: string, ownerId: string) {
        const webhook = await this.findOneWebhook(id, ownerId);
        const newSecret = crypto.randomBytes(32).toString('hex');
        webhook.secret = newSecret;
        await this.webhookRepository.save(webhook);
        return { secret: newSecret };
    }

    async testWebhook(id: string, ownerId: string, eventType?: WebhookEventType) {
        const webhook = await this.webhookRepository.findOne({
            where: { id },
            select: ['id', 'url', 'secret', 'version', 'ownerId', 'isActive'],
        });

        if (!webhook) throw new NotFoundException('Webhook not found');
        if (webhook.ownerId !== ownerId) throw new ForbiddenException();

        const type = eventType || ('ping' as any);
        const payload = WebhookPayloadBuilder.build(webhook.version, type, {
            test: true,
            message: 'This is a test webhook from Gatherraa',
        });

        return await this.deliverPayload(webhook, type, payload, 1);
    }

    async deliverPayload(
        webhook: Partial<WebhookSubscription>,
        eventType: string,
        payload: any,
        attemptNumber: number,
    ) {
        const timestamp = Math.floor(Date.now() / 1000);
        const payloadString = JSON.stringify(payload);
        const signature = this.buildSignedPayload(
            webhook.secret,
            payloadString,
            timestamp,
        );
        const deliveryId = crypto.randomUUID();

        const startTime = Date.now();
        try {
            const response = await lastValueFrom(
                this.httpService.post(webhook.url, payload, {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Gatherraa-Signature': signature,
                        'X-Gatherraa-Event': eventType,
                        'X-Gatherraa-Timestamp': timestamp.toString(),
                        'X-Gatherraa-Version': webhook.version,
                        'X-Gatherraa-Delivery-Id': deliveryId,
                    },
                    timeout: 10000,
                }),
            );

            return {
                success: response.status >= 200 && response.status < 300,
                statusCode: response.status,
                responseBody: JSON.stringify(response.data),
                durationMs: Date.now() - startTime,
            };
        } catch (error) {
            return {
                success: false,
                statusCode: error.response?.status || null,
                responseBody: error.response?.data
                    ? JSON.stringify(error.response.data)
                    : null,
                durationMs: Date.now() - startTime,
                error: error.message,
            };
        }
    }

    private buildSignedPayload(
        secret: string,
        payload: string,
        timestamp: number,
    ): string {
        const signedContent = `${timestamp}.${payload}`;
        return crypto
            .createHmac('sha256', secret)
            .update(signedContent)
            .digest('hex');
    }

    async getAnalytics(ownerId: string, webhookId: string, query: any) {
        const webhook = await this.findOneWebhook(webhookId, ownerId);

        const where: any = { webhookId };
        if (query.startDate && query.endDate) {
            where.createdAt = Between(new Date(query.startDate), new Date(query.endDate));
        }
        if (query.eventType) {
            where.eventType = query.eventType;
        }

        const [attempts, total] = await this.attemptRepository.findAndCount({
            where,
            order: { createdAt: 'DESC' },
            take: query.limit || 20,
            skip: ((query.page || 1) - 1) * (query.limit || 20),
        });

        const successCount = await this.attemptRepository.countBy({ ...where, success: true });
        const failCount = total - successCount;

        // Calculate average duration
        const qb = this.attemptRepository.createQueryBuilder('attempt');
        const { avgDuration } = await qb
            .select('AVG(attempt.durationMs)', 'avgDuration')
            .where(where)
            .getRawOne();

        // Breakdown by event type
        const eventBreakdown = await this.attemptRepository.createQueryBuilder('attempt')
            .select('attempt.eventType', 'type')
            .addSelect('COUNT(*)', 'count')
            .where(where)
            .groupBy('attempt.eventType')
            .getRawMany();

        // Breakdown by status code
        const statusBreakdown = await this.attemptRepository.createQueryBuilder('attempt')
            .select('attempt.statusCode', 'code')
            .addSelect('COUNT(*)', 'count')
            .where(where)
            .groupBy('attempt.statusCode')
            .getRawMany();

        return {
            stats: {
                totalAttempts: total,
                successCount,
                successRate: total > 0 ? (successCount / total) * 100 : 0,
                failCount,
                failRate: total > 0 ? (failCount / total) * 100 : 0,
                averageDurationMs: Math.round(avgDuration || 0),
            },
            breakdown: {
                byEventType: eventBreakdown,
                byStatusCode: statusBreakdown,
            },
            recentDeliveries: attempts,
        };
    }

    async getDeliveries(ownerId: string, webhookId: string, page = 1, limit = 20) {
        await this.findOneWebhook(webhookId, ownerId);
        const [items, total] = await this.attemptRepository.findAndCount({
            where: { webhookId },
            take: limit,
            skip: (page - 1) * limit,
            order: { createdAt: 'DESC' },
        });
        return { items, total };
    }
}
