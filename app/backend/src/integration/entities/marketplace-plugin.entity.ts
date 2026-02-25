import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum PluginType {
  LMS = 'LMS',
  CRM = 'CRM',
  PAYMENT = 'PAYMENT',
  NOTIFICATION = 'NOTIFICATION',
  ANALYTICS = 'ANALYTICS',
  PRODUCTIVITY = 'PRODUCTIVITY',
  SECURITY = 'SECURITY',
  CUSTOM = 'CUSTOM',
}

export enum PluginStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  DEPRECATED = 'DEPRECATED',
  REMOVED = 'REMOVED',
}

export enum PricingModel {
  FREE = 'FREE',
  ONE_TIME = 'ONE_TIME',
  SUBSCRIPTION = 'SUBSCRIPTION',
  USAGE_BASED = 'USAGE_BASED',
}

@Entity('marketplace_plugins')
export class MarketplacePlugin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column({ unique: true })
  slug: string;

  @Column()
  version: string;

  @Column()
  author: string;

  @Column({ nullable: true })
  authorEmail: string;

  @Column({ nullable: true })
  authorWebsite: string;

  @Column({
    type: 'enum',
    enum: PluginType,
  })
  type: PluginType;

  @Column({
    type: 'enum',
    enum: PluginStatus,
    default: PluginStatus.DRAFT,
  })
  status: PluginStatus;

  @Column({
    type: 'enum',
    enum: PricingModel,
    default: PricingModel.FREE,
  })
  pricingModel: PricingModel;

  @Column({ nullable: true })
  price: number;

  @Column({ nullable: true })
  currency: string;

  @Column('json', { nullable: true })
  features: string[];

  @Column('json', { nullable: true })
  configurationSchema: Record<string, any>;

  @Column('json', { nullable: true })
  authenticationSchema: Record<string, any>;

  @Column('json', { nullable: true })
  webhookEvents: string[];

  @Column('json', { nullable: true })
  supportedDataTypes: string[];

  @Column({ nullable: true })
  documentationUrl: string;

  @Column({ nullable: true })
  repositoryUrl: string;

  @Column({ nullable: true })
  logoUrl: string;

  @Column({ nullable: true })
  screenshots: string[];

  @Column({ default: 0 })
  downloads: number;

  @Column({ default: 0 })
  rating: number;

  @Column({ default: 0 })
  reviewCount: number;

  @Column({ default: true })
  isVerified: boolean;

  @Column({ default: false })
  isFeatured: boolean;

  @Column({ nullable: true })
  tags: string[];

  @Column({ nullable: true })
  changelog: string;

  @Column({ nullable: true })
  minimumVersion: string;

  @Column({ nullable: true })
  maximumVersion: string;

  @Column({ nullable: true })
  license: string;

  @Column({ default: 0 })
  installCount: number;

  @Column({ default: 0 })
  activeInstallCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
