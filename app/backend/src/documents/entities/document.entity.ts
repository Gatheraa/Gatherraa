import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn, 
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
  ManyToMany,
  JoinTable
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Tag } from '../../tags/entities/tag.entity';

export enum DocumentType {
  PDF = 'pdf',
  DOCX = 'docx',
  DOC = 'doc',
  XLSX = 'xlsx',
  XLS = 'xls',
  PPTX = 'pptx',
  PPT = 'ppt',
  TXT = 'txt',
  CSV = 'csv',
  JSON = 'json',
  XML = 'xml',
  HTML = 'html',
  IMAGE = 'image',
  UNKNOWN = 'unknown'
}

export enum DocumentStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ARCHIVED = 'archived'
}

export enum ProcessingStatus {
  PENDING = 'pending',
  OCR_PROCESSING = 'ocr_processing',
  PARSING = 'parsing',
  CLASSIFYING = 'classifying',
  EXTRACTING = 'extracting',
  INDEXING = 'indexing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export enum DocumentCategory {
  CONTRACT = 'contract',
  INVOICE = 'invoice',
  RECEIPT = 'receipt',
  ID_DOCUMENT = 'id_document',
  FINANCIAL_STATEMENT = 'financial_statement',
  LEGAL_DOCUMENT = 'legal_document',
  REPORT = 'report',
  PRESENTATION = 'presentation',
  SPREADSHEET = 'spreadsheet',
  EMAIL = 'email',
  IMAGE = 'image',
  OTHER = 'other'
}

export enum Language {
  EN = 'en',
  ES = 'es',
  FR = 'fr',
  DE = 'de',
  IT = 'it',
  PT = 'pt',
  RU = 'ru',
  JA = 'ja',
  KO = 'ko',
  ZH = 'zh',
  AR = 'ar',
  UNKNOWN = 'unknown'
}

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 255 })
  originalName: string;

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'varchar', length: 255 })
  filePath: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  thumbnailPath: string;

  @Column({
    type: 'enum',
    enum: DocumentType,
    default: DocumentType.UNKNOWN
  })
  @Index()
  documentType: DocumentType;

  @Column({ type: 'bigint' })
  fileSize: number;

  @Column({ type: 'varchar', length: 64 })
  fileHash: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  mimeType: string;

  @Column({
    type: 'enum',
    enum: DocumentStatus,
    default: DocumentStatus.UPLOADING
  })
  @Index()
  status: DocumentStatus;

  @Column({
    type: 'enum',
    enum: ProcessingStatus,
    default: ProcessingStatus.PENDING
  })
  @Index()
  processingStatus: ProcessingStatus;

  @Column({ type: 'text', nullable: true })
  extractedText: string;

  @Column({ type: 'jsonb', nullable: true })
  extractedMetadata: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string[];
    creationDate?: Date;
    modificationDate?: Date;
    pageCount?: number;
    wordCount?: number;
    tables?: Array<{
      title: string;
      rows: number;
      columns: number;
      data: any[][];
    }>;
    images?: Array<{
      index: number;
      width: number;
      height: number;
      format: string;
      size: number;
    }>;
    links?: Array<{
      text: string;
      url: string;
      type: 'internal' | 'external';
    }>;
    annotations?: Array<{
      type: string;
      content: string;
      page?: number;
      coordinates?: { x: number; y: number; width: number; height: number };
    }>;
  };

  @Column({
    type: 'enum',
    enum: DocumentCategory,
    default: DocumentCategory.OTHER
  })
  @Index()
  category: DocumentCategory;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @ManyToMany(() => Tag, { cascade: true })
  @JoinTable({
    name: 'document_tags',
    joinColumn: { name: 'documentId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tagId', referencedColumnName: 'id' }
  })
  tagEntities: Tag[];

  @Column({
    type: 'enum',
    enum: Language,
    default: Language.UNKNOWN
  })
  @Index()
  detectedLanguage: Language;

  @Column({ type: 'text', nullable: true })
  summary: string;

  @Column({ type: 'jsonb', nullable: true })
  keyInformation: {
    entities?: Array<{
      type: 'person' | 'organization' | 'location' | 'date' | 'amount' | 'email' | 'phone';
      text: string;
      confidence: number;
      context?: string;
    }>;
    keywords?: Array<{
      text: string;
      relevance: number;
      category?: string;
    }>;
    sentiment?: {
      score: number;
      label: 'positive' | 'negative' | 'neutral';
      confidence: number;
    };
    topics?: Array<{
      topic: string;
      confidence: number;
      keywords: string[];
    }>;
  };

  @Column({ type: 'jsonb', nullable: true })
  translationData: {
    originalLanguage: Language;
    availableTranslations: Array<{
      language: Language;
      translatedText: string;
      translatedAt: Date;
      translatedBy: 'ai' | 'human';
    }>;
  };

  @Column({ type: 'jsonb', nullable: true })
  similarityData: {
    documentHashes: Array<{
      algorithm: string;
      hash: string;
    }>;
    similarDocuments: Array<{
      documentId: string;
      similarity: number;
      algorithm: string;
    }>;
    isDuplicate: boolean;
    duplicateOf?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  complianceData: {
    checks: Array<{
      checkType: string;
      status: 'passed' | 'failed' | 'warning';
      details: string;
      timestamp: Date;
    }>;
    overallStatus: 'compliant' | 'non_compliant' | 'requires_review';
    lastChecked: Date;
  };

  @Column({ type: 'jsonb', nullable: true })
  processingErrors: Array<{
    step: string;
    error: string;
    timestamp: Date;
    retryCount: number;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  processingMetrics: {
    ocrProcessingTime?: number;
    parsingTime?: number;
    classificationTime?: number;
    extractionTime?: number;
    indexingTime?: number;
    totalProcessingTime?: number;
    confidence?: number;
  };

  @Column({ type: 'varchar', length: 255, nullable: true })
  parentDocumentId: string;

  @ManyToOne(() => Document, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parentDocumentId' })
  parentDocument: Document;

  @OneToMany(() => Document, doc => doc.parentDocument)
  childDocuments: Document[];

  @Column({ type: 'boolean', default: false })
  isPublic: boolean;

  @Column({ type: 'boolean', default: false })
  isEncrypted: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  encryptionKey: string;

  @Column({ type: 'jsonb', nullable: true })
  accessControl: {
    allowedUsers: string[];
    allowedRoles: string[];
    permissions: Array<{
      userId?: string;
      roleId?: string;
      permissions: string[];
      expiresAt?: Date;
    }>;
  };

  @Column({ type: 'jsonb', nullable: true })
  customFields: Record<string, any>;

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date;

  @Column({ type: 'datetime', nullable: true })
  archivedAt: Date;

  @Column({ type: 'text', nullable: true })
  archiveReason: string;

  @CreateDateColumn()
  @Index()
  createdAt: Date;

  @UpdateDateColumn()
  @Index()
  updatedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  lastAccessedAt: Date;

  @Column({ type: 'bigint', default: 0 })
  accessCount: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  uploadedFrom: string;

  @Column({ type: 'jsonb', nullable: true })
  uploadMetadata: {
    ipAddress?: string;
    userAgent?: string;
    source?: 'web' | 'api' | 'mobile' | 'email';
    batchId?: string;
  };
}

@Entity('document_processing_jobs')
export class DocumentProcessingJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  documentId: string;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId' })
  document: Document;

  @Column({ type: 'varchar', length: 100 })
  jobType: string;

  @Column({
    type: 'enum',
    enum: ProcessingStatus,
    default: ProcessingStatus.PENDING
  })
  @Index()
  status: ProcessingStatus;

  @Column({ type: 'jsonb', nullable: true })
  parameters: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  result: any;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'int', default: 3 })
  maxRetries: number;

  @Column({ type: 'datetime', nullable: true })
  scheduledAt: Date;

  @Column({ type: 'datetime', nullable: true })
  startedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  workerId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('document_similarity_cache')
export class DocumentSimilarityCache {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  documentId1: string;

  @Column({ type: 'uuid' })
  @Index()
  documentId2: string;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId1' })
  document1: Document;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId2' })
  document2: Document;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  @Index()
  similarity: number;

  @Column({ type: 'varchar', length: 50 })
  algorithm: string;

  @Column({ type: 'jsonb', nullable: true })
  details: {
    textSimilarity?: number;
    metadataSimilarity?: number;
    contentSimilarity?: number;
    features?: string[];
  };

  @CreateDateColumn()
  @Index()
  calculatedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date;
}
