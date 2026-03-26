import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Event } from '../../events/entities/event.entity';

@Entity('waitlist_analytics')
export class WaitlistAnalytics {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'eventId' })
    @Index()
    eventId: string;

    @ManyToOne(() => Event)
    @JoinColumn({ name: 'eventId' })
    event: Event;

    @Column({ default: 0 })
    totalWaitlisted: number;

    @Column({ default: 0 })
    totalInvited: number;

    @Column({ default: 0 })
    totalConverted: number;

    @Column({ default: 0 })
    totalExpired: number;

    @Column({ type: 'float', default: 0 })
    averageWaitTimeMinutes: number;

    @Column({ type: 'datetime' })
    snapshotAt: Date;

    @CreateDateColumn()
    createdAt: Date;
}
