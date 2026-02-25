import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, UpdateDateColumn } from 'typeorm';
import { Integration } from './integration.entity';

export enum TestStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum TestType {
  CONNECTIVITY = 'CONNECTIVITY',
  AUTHENTICATION = 'AUTHENTICATION',
  DATA_SYNC = 'DATA_SYNC',
  WEBHOOK = 'WEBHOOK',
  PERFORMANCE = 'PERFORMANCE',
  SECURITY = 'SECURITY',
  COMPLIANCE = 'COMPLIANCE',
  END_TO_END = 'END_TO_END',
}

@Entity('integration_test_results')
export class IntegrationTestResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Integration, (integration) => integration.id)
  integration: Integration;

  @Column()
  integrationId: string;

  @Column()
  testName: string;

  @Column()
  description: string;

  @Column({
    type: 'enum',
    enum: TestType,
  })
  testType: TestType;

  @Column({
    type: 'enum',
    enum: TestStatus,
    default: TestStatus.PENDING,
  })
  status: TestStatus;

  @Column({ nullable: true })
  startedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @Column({ nullable: true })
  duration: number; // in milliseconds

  @Column('json', { nullable: true })
  testParameters: Record<string, any>;

  @Column('json', { nullable: true })
  testResults: Record<string, any>;

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ nullable: true })
  stackTrace: string;

  @Column({ default: 0 })
  assertionsRun: number;

  @Column({ default: 0 })
  assertionsPassed: number;

  @Column({ default: 0 })
  assertionsFailed: number;

  @Column('json', { nullable: true })
  performanceMetrics: Record<string, number>;

  @Column({ nullable: true })
  environment: string;

  @Column({ nullable: true })
  version: string;

  @Column({ nullable: true })
  executedBy: string;

  @Column({ nullable: true })
  requestId: string;

  @Column({ default: false })
  isAutomated: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
