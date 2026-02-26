import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('data_breaches')
export class DataBreach {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  incidentId: string;

  @Column('text')
  description: string;

  @Column({
    type: 'enum',
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  })
  severity: string;

  @Column({
    type: 'enum',
    enum: ['confidentiality', 'integrity', 'availability', 'all'],
    default: 'confidentiality'
  })
  breachType: string;

  @Column('timestamp')
  detectionDate: Date;

  @Column('timestamp', { nullable: true })
  breachStartDate: Date;

  @Column('timestamp', { nullable: true })
  containmentDate: Date;

  @Column('timestamp', { nullable: true })
  resolutionDate: Date;

  @Column('jsonb')
  affectedData: {
    dataCategories: string[];
    recordsCount: number;
    usersAffected: number;
    specialCategories: string[];
  };

  @Column('jsonb')
  affectedSystems: Array<{
    systemName: string;
    components: string[];
    accessLevel: string;
  }>;

  @Column('jsonb')
  causes: Array<{
    type: string;
    description: string;
    likelihood: string;
  }>;

  @Column('jsonb')
  impacts: {
    financial: string;
    reputational: string;
    regulatory: string;
    operational: string;
  };

  @Column('jsonb')
  responseActions: Array<{
    action: string;
    timestamp: Date;
    responsible: string;
    status: string;
  }>;

  @Column('jsonb')
  notifications: {
    supervisoryAuthority: {
      required: boolean;
      sent: boolean;
      sentAt: Date;
      reference: string;
    };
    dataSubjects: {
      required: boolean;
      sent: boolean;
      sentAt: Date;
      method: string;
      count: number;
    };
    stakeholders: Array<{
      name: string;
      notified: boolean;
      notifiedAt: Date;
      method: string;
    }>;
  };

  @Column('jsonb')
  mitigationMeasures: Array<{
    measure: string;
    implemented: boolean;
    implementedAt: Date;
    effectiveness: string;
  }>;

  @Column('text', { nullable: true })
  lessonsLearned: string;

  @Column('jsonb', { nullable: true })
  recommendations: Array<{
    recommendation: string;
    priority: string;
    assignee: string;
    dueDate: Date;
    status: string;
  }>;

  @Column('jsonb')
  complianceRequirements: {
    gdpr72Hours: boolean;
    ccpaNotification: boolean;
    documentationRequired: boolean;
    reportGenerated: boolean;
  };

  @Column('jsonb', { nullable: true })
  forensicReport: {
    investigator: string;
    reportDate: Date;
    findings: string;
    methodology: string;
  };

  @Column({
    type: 'enum',
    enum: ['open', 'investigating', 'contained', 'resolved', 'closed'],
    default: 'open'
  })
  status: string;

  @Column('text', { nullable: true })
  assignedTo: string;

  @Column('jsonb', { nullable: true })
  auditTrail: Array<{
    timestamp: Date;
    action: string;
    userId: string;
    details: string;
    previousState: string;
    newState: string;
  }>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
