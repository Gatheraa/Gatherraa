import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum KycStatus {
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended',
}

export enum KycLevel {
  LEVEL_0 = 'level_0', // No verification
  LEVEL_1 = 'level_1', // Basic identity
  LEVEL_2 = 'level_2', // Enhanced verification
  LEVEL_3 = 'level_3', // Professional verification
}

export enum KycDocumentType {
  PASSPORT = 'passport',
  DRIVERS_LICENSE = 'drivers_license',
  NATIONAL_ID = 'national_id',
  RESIDENCE_PERMIT = 'residence_permit',
  SELFIE = 'selfie',
  PROOF_OF_ADDRESS = 'proof_of_address',
  TAX_ID = 'tax_id',
  BUSINESS_REGISTRATION = 'business_registration',
  BANK_STATEMENT = 'bank_statement',
}

export enum AmlRiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum AmlCheckType {
  SANCTION_LIST = 'sanction_list',
  PEP_LIST = 'pep_list',
  ADVERSE_MEDIA = 'adverse_media',
  WATCH_LIST = 'watch_list',
}

@Entity('kyc_verifications')
export class KycVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: KycStatus,
    default: KycStatus.PENDING,
  })
  status: KycStatus;

  @Column({
    type: 'enum',
    enum: KycLevel,
    default: KycLevel.LEVEL_0,
  })
  level: KycLevel;

  @Column({ type: 'jsonb' })
  personalInfo: {
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    nationality: string;
    countryOfResidence: string;
    address: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
    phoneNumber: string;
    email: string;
    occupation?: string;
    sourceOfFunds?: string;
    annualIncome?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  businessInfo?: {
    companyName: string;
    registrationNumber: string;
    businessType: string;
    industry: string;
    incorporationDate: Date;
    businessAddress: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
    directors?: Array<{
      name: string;
      dateOfBirth: Date;
      nationality: string;
      ownershipPercentage: number;
    }>;
    beneficialOwners?: Array<{
      name: string;
      dateOfBirth: Date;
      nationality: string;
      ownershipPercentage: number;
    }>;
  };

  @Column({ type: 'jsonb', nullable: true })
  verificationData: {
    documents: Array<{
      type: KycDocumentType;
      url: string;
      hash: string;
      uploadedAt: Date;
      verifiedAt?: Date;
      status: 'pending' | 'verified' | 'rejected';
      rejectionReason?: string;
    }>;
    biometricData?: {
      facialRecognitionScore: number;
      livenessCheckScore: number;
      documentAuthenticityScore: number;
    };
    addressVerification?: {
      method: string;
      verifiedAt: Date;
      status: 'verified' | 'rejected';
    };
  };

  @Column({ type: 'jsonb', nullable: true })
  amlData: {
    riskLevel: AmlRiskLevel;
    checks: Array<{
      type: AmlCheckType;
      status: 'passed' | 'failed' | 'warning';
      details?: any;
      checkedAt: Date;
    }>;
    riskFactors: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high';
      description: string;
    }>;
    recommendations?: string[];
    lastChecked: Date;
    nextReviewDate: Date;
  };

  @Column({ type: 'jsonb', nullable: true })
  reviewData: {
    reviewedBy?: string;
    reviewedAt?: Date;
    notes?: string;
    approvedLevel?: KycLevel;
    conditions?: string[];
    monitoringRequired?: boolean;
    reviewFrequency?: number; // days
  };

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    deviceFingerprint?: string;
    geolocation?: {
      country: string;
      city: string;
      coordinates: [number, number];
    };
    submissionSource?: string;
    estimatedRisk?: AmlRiskLevel;
  };

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date;

  @Column({ type: 'datetime', nullable: true })
  lastReviewedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  nextReviewAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('kyc_documents')
export class KycDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  verificationId: string;

  @ManyToOne(() => KycVerification, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'verificationId' })
  verification: KycVerification;

  @Column({
    type: 'enum',
    enum: KycDocumentType,
  })
  type: KycDocumentType;

  @Column({ type: 'varchar' })
  fileName: string;

  @Column({ type: 'varchar' })
  fileUrl: string;

  @Column({ type: 'varchar' })
  fileHash: string;

  @Column({ type: 'jsonb' })
  fileMetadata: {
    size: number;
    mimeType: string;
    dimensions?: {
      width: number;
      height: number;
    };
    extractedText?: string;
    qrCodeData?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  extractedData: {
    documentNumber?: string;
    issuingCountry?: string;
    expiryDate?: Date;
    dateOfBirth?: Date;
    fullName?: string;
    address?: string;
    mrz?: string; // Machine Readable Zone
  };

  @Column({ type: 'jsonb', nullable: true })
  verificationResults: {
    authenticityScore: number;
    tamperingDetected: boolean;
    forgeryIndicators: string[];
    qualityScore: number;
    ocrConfidence: number;
  };

  @Column({
    type: 'enum',
    enum: ['pending', 'verified', 'rejected', 'needs_review'],
    default: 'pending',
  })
  status: string;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ type: 'datetime', nullable: true })
  verifiedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  verifiedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('aml_alerts')
export class AmlAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: AmlRiskLevel,
  })
  riskLevel: AmlRiskLevel;

  @Column({
    type: 'enum',
    enum: AmlCheckType,
  })
  checkType: AmlCheckType;

  @Column({ type: 'varchar' })
  alertType: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb' })
  alertData: {
    matchedLists?: string[];
    matchedEntities?: Array<{
      name: string;
      type: string;
      list: string;
      confidence: number;
    }>;
    transactionPatterns?: Array<{
      pattern: string;
      frequency: number;
      amount: number;
    }>;
    riskFactors: Array<{
      type: string;
      weight: number;
      description: string;
    }>;
    totalRiskScore: number;
  };

  @Column({
    type: 'enum',
    enum: ['new', 'investigating', 'resolved', 'false_positive', 'escalated'],
    default: 'new',
  })
  status: string;

  @Column({ type: 'jsonb', nullable: true })
  investigation: {
    assignedTo?: string;
    assignedAt?: Date;
    notes?: string;
    actions?: Array<{
      action: string;
      performedBy: string;
      performedAt: Date;
      details?: string;
    }>;
    resolution?: string;
    resolvedBy?: string;
    resolvedAt?: Date;
  };

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    triggeredBy?: string;
    ipAddress?: string;
    transactionId?: string;
    sessionId?: string;
    automated?: boolean;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  resolvedAt: Date;
}
