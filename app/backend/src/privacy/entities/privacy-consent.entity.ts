import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PrivacyPolicy } from './privacy-policy.entity';
import { User } from '../../users/entities/user.entity';

@Entity('privacy_consents')
export class PrivacyConsent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  privacyPolicyId: string;

  @ManyToOne(() => PrivacyPolicy)
  @JoinColumn({ name: 'privacyPolicyId' })
  privacyPolicy: PrivacyPolicy;

  @Column({
    type: 'enum',
    enum: ['granted', 'denied', 'withdrawn'],
    default: 'granted'
  })
  status: string;

  @Column('jsonb')
  consentDetails: {
    marketing: boolean;
    analytics: boolean;
    personalization: boolean;
    thirdPartySharing: boolean;
    cookies: boolean;
    emailCommunications: boolean;
    smsCommunications: boolean;
    locationTracking: boolean;
    biometricData: boolean;
    financialData: boolean;
  };

  @Column('text', { nullable: true })
  ipAddress: string;

  @Column('text', { nullable: true })
  userAgent: string;

  @Column('text', { nullable: true })
  consentLanguage: string;

  @Column('jsonb', { nullable: true })
  consentMetadata: Record<string, any>;

  @Column('timestamp', { nullable: true })
  withdrawnAt: Date;

  @Column('text', { nullable: true })
  withdrawalReason: string;

  @Column('timestamp', { nullable: true })
  lastReviewedAt: Date;

  @Column('boolean', { default: false })
  isLegitimateInterest: boolean;

  @Column('text', { nullable: true })
  legitimateInterestBasis: string;

  @Column('jsonb', { nullable: true })
  granularPreferences: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
