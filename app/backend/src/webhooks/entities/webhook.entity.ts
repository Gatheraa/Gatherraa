import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
  ManyToOne,
} from 'typeorm';
import { WebhookEventType } from '../constants/webhook.constants';
import { User } from 'src/users/entities/user.entity';

@Entity('webhooks')
export class Webhook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'text' })
  secret: string;

  @Column({
    type: 'simple-array',
    default: WebhookEventType.TEST
  })
  events: WebhookEventType[];

  @Column({ default: 'v1' })
  version: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  description: string;

  @ManyToOne(() => User, { nullable: true })
  creator: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId: string;
}
