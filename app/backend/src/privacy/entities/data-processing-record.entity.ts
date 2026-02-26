import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PrivacyPolicy } from './privacy-policy.entity';

@Entity('data_processing_records')
export class DataProcessingRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  privacyPolicyId: string;

  @ManyToOne(() => PrivacyPolicy)
  @JoinColumn({ name: 'privacyPolicyId' })
  privacyPolicy: PrivacyPolicy;

  @Column()
  controllerName: string;

  @Column('text', { nullable: true })
  controllerContact: string;

  @Column('text', { nullable: true })
  dpoContact: string;

  @Column('jsonb')
  dataCategories: {
    personalData: string[];
    specialCategories: string[];
    processedData: string[];
  };

  @Column('jsonb')
  processingPurposes: {
    primary: string[];
    secondary: string[];
    legitimateInterests: string[];
  };

  @Column('jsonb')
  dataSubjects: {
    categories: string[];
    description: string;
  };

  @Column('jsonb')
  recipients: {
    internal: string[];
    external: string[];
    thirdCountries: string[];
  };

  @Column('jsonb')
  retentionPeriods: Record<string, {
    duration: string;
    justification: string;
    deletionMethod: string;
  }>;

  @Column('jsonb')
  securityMeasures: {
    technical: string[];
    organizational: string[];
    encryption: boolean;
    pseudonymization: boolean;
    accessControls: boolean;
  };

  @Column('jsonb')
  internationalTransfers: {
    countries: string[];
    mechanisms: string[];
    adequacyDecisions: string[];
    safeguards: string[];
  };

  @Column('jsonb')
  processingActivities: Array<{
    activity: string;
    purpose: string;
    legalBasis: string;
    dataTypes: string[];
    recipients: string[];
    retention: string;
    security: string[];
  }>;

  @Column({
    type: 'enum',
    enum: ['active', 'inactive', 'under_review', 'deprecated'],
    default: 'active'
  })
  status: string;

  @Column('date', { nullable: true })
  lastReviewDate: Date;

  @Column('date', { nullable: true })
  nextReviewDate: Date;

  @Column('text', { nullable: true })
  riskAssessment: string;

  @Column('jsonb', { nullable: true })
  complianceChecks: {
    gdpr: boolean;
    ccpa: boolean;
    ferpa: boolean;
    hipaa: boolean;
    lastChecked: Date;
  };

  @Column('jsonb', { nullable: true })
  auditTrail: Array<{
    timestamp: Date;
    action: string;
    userId: string;
    details: string;
  }>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
