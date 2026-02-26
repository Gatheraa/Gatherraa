import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('privacy_audits')
export class PrivacyAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  auditId: string;

  @Column('text')
  title: string;

  @Column('text')
  description: string;

  @Column({
    type: 'enum',
    enum: ['GDPR', 'CCPA', 'FERPA', 'HIPAA', 'ISO27001', 'SOC2', 'CUSTOM'],
    default: 'GDPR'
  })
  framework: string;

  @Column({
    type: 'enum',
    enum: ['planned', 'in_progress', 'completed', 'failed', 'cancelled'],
    default: 'planned'
  })
  status: string;

  @Column('date')
  scheduledDate: Date;

  @Column('date', { nullable: true })
  completedDate: Date;

  @Column('jsonb')
  scope: {
    systems: string[];
    processes: string[];
    dataCategories: string[];
    geographicRegions: string[];
  };

  @Column('jsonb')
  criteria: Array<{
    requirement: string;
    description: string;
    evidence: string[];
    status: string;
    findings: string;
  }>;

  @Column('jsonb')
  findings: Array<{
    category: string;
    severity: string;
    description: string;
    recommendation: string;
    riskLevel: string;
  }>;

  @Column('jsonb')
  complianceScore: {
    overall: number;
    categories: Record<string, number>;
    trend: string;
  };

  @Column('jsonb')
  remediationPlan: Array<{
    action: string;
    priority: string;
    assignee: string;
    dueDate: Date;
    status: string;
  }>;

  @Column('jsonb')
  evidence: Array<{
    type: string;
    description: string;
    location: string;
    collectedAt: Date;
  }>;

  @Column('text', { nullable: true })
  auditorName: string;

  @Column('text', { nullable: true })
  auditorCredentials: string;

  @Column('jsonb', { nullable: true })
  stakeholders: Array<{
    name: string;
    role: string;
    contact: string;
  }>;

  @Column('jsonb')
  recommendations: Array<{
    priority: string;
    category: string;
    description: string;
    implementation: string;
    timeline: string;
  }>;

  @Column('jsonb', { nullable: true })
  nextAuditPlan: {
    frequency: string;
    nextDate: Date;
    focusAreas: string[];
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
