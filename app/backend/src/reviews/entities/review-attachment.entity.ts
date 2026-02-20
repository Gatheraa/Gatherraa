import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Review } from './review.entity';

export enum AttachmentType {
  PHOTO = 'PHOTO',
  VIDEO = 'VIDEO',
}

@Entity('review_attachments')
export class ReviewAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  reviewId: string;

  @Column({
    type: 'varchar',
    length: 20,
  })
  type: AttachmentType;

  @Column({ type: 'varchar', length: 500 })
  url: string; // CDN URL

  @Column({ type: 'varchar', length: 500, nullable: true })
  thumbnailUrl: string | null; // For videos

  @Column({ type: 'varchar', length: 255 })
  filename: string;

  @Column({ type: 'varchar', length: 100 })
  mimeType: string;

  @Column({ type: 'bigint' })
  size: number; // bytes

  @ManyToOne(() => Review, (review) => review.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reviewId' })
  review: Review;

  @CreateDateColumn()
  createdAt: Date;
}
