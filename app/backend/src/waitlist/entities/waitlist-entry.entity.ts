import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Event } from '../../events/entities/event.entity';

export enum WaitlistStatus {
    PENDING = 'pending',
    INVITED = 'invited',
    EXPIRED = 'expired',
    CONVERTED = 'converted',
}

@Entity('waitlist_entries')
export class WaitlistEntry {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'eventId' })
    @Index()
    eventId: string;

    @ManyToOne(() => Event)
    @JoinColumn({ name: 'eventId' })
    event: Event;

    @Column({ name: 'userId' })
    @Index()
    userId: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ type: 'float', default: 0 })
    @Index()
    priorityScore: number;

    @Column({ nullable: true })
    referralCode: string;

    @Column({ nullable: true })
    referredBy: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'referredBy' })
    referrer: User;

    @Column({
        type: 'varchar',
        default: WaitlistStatus.PENDING,
    })
    @Index()
    status: WaitlistStatus;

    @Column({ type: 'datetime', nullable: true })
    inviteSentAt: Date;

    @Column({ type: 'datetime', nullable: true })
    inviteExpiresAt: Date;

    @Column({ type: 'datetime' })
    expiresAt: Date;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
