import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Referral } from './referral.entity';
import { User } from '../../users/entities/user.entity';

@Entity('referral_rewards')
export class ReferralReward {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Referral, { nullable: false })
  referral: Referral;

  @ManyToOne(() => User, { nullable: false })
  beneficiary: User; // who received this reward (usually referrer)

  @Column({ type: 'float', default: 0 })
  amount: number;

  @Column({ type: 'boolean', default: false })
  distributed: boolean;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128, nullable: true })
  idempotencyKey: string | null; // used to ensure idempotent distribution

  @CreateDateColumn()
  createdAt: Date;
}
