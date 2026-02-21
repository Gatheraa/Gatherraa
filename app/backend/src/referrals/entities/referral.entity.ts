import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ReferralCode } from './referral-code.entity';
import { User } from '../../users/entities/user.entity';

@Entity('referrals')
export class Referral {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ReferralCode, { nullable: false })
  code: ReferralCode;

  @ManyToOne(() => User, { nullable: false })
  referrer: User; // owner of code

  @ManyToOne(() => User, { nullable: false })
  referee: User; // user who redeemed

  @Column({ type: 'int', default: 1 })
  level: number; // 1 = direct, 2 = second level, etc.

  @Column({ type: 'varchar', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;
}
