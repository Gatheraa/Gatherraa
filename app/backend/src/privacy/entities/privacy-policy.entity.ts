import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { PrivacyConsent } from './privacy-consent.entity';
import { DataProcessingRecord } from './data-processing-record.entity';

@Entity('privacy_policies')
export class PrivacyPolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  version: string;

  @Column('text')
  content: string;

  @Column({
    type: 'enum',
    enum: ['GDPR', 'CCPA', 'FERPA', 'HIPAA', 'CUSTOM'],
    default: 'GDPR'
  })
  regulationType: string;

  @Column({
    type: 'enum',
    enum: ['draft', 'active', 'deprecated', 'archived'],
    default: 'draft'
  })
  status: string;

  @Column('jsonb')
  dataCategories: string[];

  @Column('jsonb')
  processingPurposes: string[];

  @Column('jsonb')
  dataRetentionPeriods: Record<string, string>;

  @Column('jsonb')
  userRights: string[];

  @Column('jsonb')
  cookieSettings: Record<string, any>;

  @Column('jsonb')
  crossBorderTransfers: Record<string, any>;

  @Column('text', { nullable: true })
  dpoContact: string;

  @Column('date', { nullable: true })
  effectiveDate: Date;

  @Column('date', { nullable: true })
  reviewDate: Date;

  @OneToMany(() => PrivacyConsent, consent => consent.privacyPolicy)
  consents: PrivacyConsent[];

  @OneToMany(() => DataProcessingRecord, record => record.privacyPolicy)
  processingRecords: DataProcessingRecord[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
