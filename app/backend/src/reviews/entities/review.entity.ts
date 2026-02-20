import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
  JoinColumn,
} from 'typeorm';
import { Event } from '../../events/entities/event.entity';
import { User } from '../../users/entities/user.entity';
import { ReviewAttachment } from './review-attachment.entity';
import { ReviewVote } from './review-vote.entity';
import { ReviewReport } from './review-report.entity';

export enum ReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  FLAGGED = 'FLAGGED',
}

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  eventId: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @Column({ type: 'int' })
  rating: number; // 1-5

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string | null;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: ReviewStatus.PENDING,
  })
  status: ReviewStatus;

  @Column({ type: 'varchar', length: 36, nullable: true })
  moderatorId: string | null;

  @Column({ type: 'datetime', nullable: true })
  moderatedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  moderationReason: string | null;

  @Column({ type: 'int', default: 0 })
  helpfulCount: number;

  @Column({ type: 'int', default: 0 })
  reportCount: number;

  @ManyToOne(() => Event, (event) => event.reviews)
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'moderatorId' })
  moderator: User | null;

  @OneToMany(() => ReviewAttachment, (attachment) => attachment.review, { cascade: true })
  attachments: ReviewAttachment[];

  @OneToMany(() => ReviewVote, (vote) => vote.review)
  helpfulVotes: ReviewVote[];

  @OneToMany(() => ReviewReport, (report) => report.review)
  reports: ReviewReport[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
