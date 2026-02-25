import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('flag_evaluations')
@Index(['flagKey', 'userId', 'createdAt'])
export class FlagEvaluation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  flagKey: string;

  @Column()
  @Index()
  userId: string;

  @Column({ type: 'simple-json' })
  value: any;

  @Column({ nullable: true })
  variant: string; // For A/B testing

  @Column({ type: 'simple-json', nullable: true })
  context: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  reason: string; // Why this value was returned (e.g., 'whitelist', 'targeting_rule', 'rollout', 'default')

  @CreateDateColumn()
  createdAt: Date;
}
