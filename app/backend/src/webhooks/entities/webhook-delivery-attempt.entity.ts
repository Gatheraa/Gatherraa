import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { WebhookSubscription } from './webhook-subscription.entity';

@Entity('webhook_delivery_attempts')
export class WebhookDeliveryAttempt {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    webhookId: string;

    @ManyToOne(() => WebhookSubscription, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'webhookId' })
    webhook: WebhookSubscription;

    @Column()
    eventType: string;

    @Column('simple-json')
    payload: any;

    @Column({ nullable: true })
    statusCode: number;

    @Column({ nullable: true, type: 'text' })
    responseBody: string;

    @Column()
    success: boolean;

    @Column()
    attemptNumber: number;

    @Column()
    durationMs: number;

    @Column({ nullable: true, type: 'text' })
    error: string;

    @CreateDateColumn()
    createdAt: Date;
}
