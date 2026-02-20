import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Event } from '../../events/entities/event.entity';

@Entity('event_ratings')
@Unique(['eventId'])
export class EventRating {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 36, unique: true })
  eventId: string;

  @Column({ type: 'decimal', precision: 3, scale: 2 })
  averageRating: number; // 1.00 to 5.00

  @Column({ type: 'int', default: 0 })
  totalReviews: number;

  @Column({ type: 'simple-json' })
  ratingDistribution: Record<number, number>; // { 1: count, 2: count, ... }

  @Column({ type: 'datetime' })
  lastCalculatedAt: Date;

  @ManyToOne(() => Event)
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @CreateDateColumn()
  createdAt: Date;
}
