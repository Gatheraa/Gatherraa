import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('email_bounce_complaints')
@Index(['email', 'type'])
@Index(['status'])
@Index(['createdAt'])
export class EmailBounceComplaint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column()
  type: 'BOUNCE' | 'COMPLAINT' | 'SUPPRESSION';

  @Column({
    default: 'ACTIVE',
  })
  status: 'ACTIVE' | 'RESOLVED' | 'ARCHIVED';

  @Column({ nullable: true })
  bounceType: string; // PERMANENT, TEMPORARY, TRANSIENT

  @Column({ nullable: true })
  complaintType: string; // ABUSE, FRAUD, PERMANENT, TRANSIENT

  @Column({ nullable: true })
  reason: string;

  @Column({ nullable: true })
  diagnosticCode: string;

  @Column({ type: 'json', nullable: true })
  rawData: Record<string, any>;

  @Column({ nullable: true })
  emailLogId: string;

  @Column({ nullable: true })
  template: string;

  @Column({ default: 1 })
  occurrenceCount: number;

  @Column({ nullable: true })
  resolvedAt: Date;

  @Column({ nullable: true })
  resolvedBy: string; // Manual resolution notes

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
