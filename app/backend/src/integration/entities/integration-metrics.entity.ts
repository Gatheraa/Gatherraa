import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { Integration } from './integration.entity';

export enum MetricType {
  API_CALLS = 'API_CALLS',
  RESPONSE_TIME = 'RESPONSE_TIME',
  ERROR_RATE = 'ERROR_RATE',
  SUCCESS_RATE = 'SUCCESS_RATE',
  DATA_VOLUME = 'DATA_VOLUME',
  WEBHOOK_DELIVERIES = 'WEBHOOK_DELIVERIES',
  AUTHENTICATION_FAILURES = 'AUTHENTICATION_FAILURES',
  RATE_LIMIT_HITS = 'RATE_LIMIT_HITS',
}

export enum MetricPeriod {
  MINUTE = 'MINUTE',
  HOUR = 'HOUR',
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
}

@Entity('integration_metrics')
export class IntegrationMetrics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Integration, (integration) => integration.metrics)
  integration: Integration;

  @Column()
  integrationId: string;

  @Column({
    type: 'enum',
    enum: MetricType,
  })
  metricType: MetricType;

  @Column({
    type: 'enum',
    enum: MetricPeriod,
  })
  period: MetricPeriod;

  @Column()
  value: number;

  @Column('json', { nullable: true })
  dimensions: Record<string, string>;

  @Column({ nullable: true })
  unit: string;

  @Column()
  timestamp: Date;

  @Column('json', { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
