import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
    Index,
    VersionColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Event } from '../../events/entities/event.entity';

export enum SeatStatus {
    AVAILABLE = 'available',
    RESERVED = 'reserved',
    BOOKED = 'booked',
    UNAVAILABLE = 'unavailable',
}

export enum BookingStatus {
    PENDING = 'pending',
    CONFIRMED = 'confirmed',
    CANCELLED = 'cancelled',
    EXPIRED = 'expired',
}

@Entity('seats')
@Index(['eventId', 'section', 'row', 'number'], { unique: true })
@Index(['eventId', 'status'])
export class Seat {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid')
    @Index()
    eventId: string;

    @ManyToOne(() => Event, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'eventId' })
    event: Event;

    @Column({ type: 'varchar', length: 100 })
    section: string;

    @Column({ type: 'varchar', length: 50 })
    row: string;

    @Column({ type: 'varchar', length: 50 })
    number: string;

    @Column({
        type: 'varchar',
        default: SeatStatus.AVAILABLE,
    })
    status: SeatStatus;

    @Column('decimal', { precision: 10, scale: 2 })
    price: number;

    @Column({ type: 'varchar', length: 50, default: 'general' })
    tier: string;

    @VersionColumn()
    version: number;

    @Column('uuid', { nullable: true })
    reservedBy: string | null;

    @Column({ type: 'datetime', nullable: true })
    reservedUntil: Date | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}

@Entity('bookings')
@Index(['userId', 'status'])
@Index(['eventId', 'status'])
export class Booking {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid')
    @Index()
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column('uuid')
    @Index()
    eventId: string;

    @ManyToOne(() => Event, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'eventId' })
    event: Event;

    @Column({
        type: 'varchar',
        default: BookingStatus.PENDING,
    })
    status: BookingStatus;

    @Column('decimal', { precision: 10, scale: 2 })
    totalAmount: number;

    @Column('decimal', { precision: 10, scale: 2, default: 0 })
    discountAmount: number;

    @Column('decimal', { precision: 10, scale: 2 })
    finalAmount: number;

    @Column({ type: 'varchar', length: 10, default: 'USD' })
    currency: string;

    @Column({ type: 'varchar', length: 50, nullable: true })
    promoCode: string | null;

    @Column({ type: 'datetime', nullable: true })
    reservationExpiresAt: Date | null;

    @Column({ type: 'datetime', nullable: true })
    confirmedAt: Date | null;

    @Column({ type: 'datetime', nullable: true })
    cancelledAt: Date | null;

    @Column({ type: 'text', nullable: true })
    cancellationReason: string | null;

    @Column({ type: 'simple-json', nullable: true })
    metadata: Record<string, any> | null;

    @OneToMany(() => BookingItem, (item) => item.booking, {
        eager: true,
        cascade: true,
    })
    items: BookingItem[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}

@Entity('booking_items')
@Index(['bookingId'])
@Index(['seatId'])
export class BookingItem {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid')
    bookingId: string;

    @ManyToOne(() => Booking, (booking) => booking.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'bookingId' })
    booking: Booking;

    @Column('uuid')
    seatId: string;

    @ManyToOne(() => Seat, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'seatId' })
    seat: Seat;

    @Column('decimal', { precision: 10, scale: 2 })
    unitPrice: number;

    @Column('decimal', { precision: 10, scale: 2 })
    finalPrice: number;

    @CreateDateColumn()
    createdAt: Date;
}
