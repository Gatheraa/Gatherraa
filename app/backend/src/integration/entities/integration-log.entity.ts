import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { Integration } from './integration.entity';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
}

export enum LogCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  DATA_SYNC = 'DATA_SYNC',
  WEBHOOK = 'WEBHOOK',
  API_CALL = 'API_CALL',
  ERROR = 'ERROR',
  PERFORMANCE = 'PERFORMANCE',
  SECURITY = 'SECURITY',
}

@Entity('integration_logs')
export class IntegrationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Integration, (integration) => integration.logs)
  integration: Integration;

  @Column()
  integrationId: string;

  @Column({
    type: 'enum',
    enum: LogLevel,
  })
  level: LogLevel;

  @Column({
    type: 'enum',
    enum: LogCategory,
  })
  category: LogCategory;

  @Column()
  message: string;

  @Column('json', { nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  requestId: string;

  @Column({ nullable: true })
  userId: string;

  @Column({ nullable: true })
  externalId: string;

  @Column({ nullable: true })
  duration: number; // in milliseconds

  @Column({ nullable: true })
  statusCode: number;

  @Column({ nullable: true })
  errorCode: string;

  @Column({ nullable: true })
  stackTrace: string;

  @Column({ default: false })
  isResolved: boolean;

  @Column({ nullable: true })
  resolvedAt: Date;

  @Column({ nullable: true })
  resolvedBy: string;

  @CreateDateColumn()
  createdAt: Date;
}
