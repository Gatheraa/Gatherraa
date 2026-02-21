import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { IsString, IsNumber, IsBoolean, IsDate, IsOptional, IsEnum, IsObject } from 'class-validator';

export enum EventStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

export enum EventType {
  CONFERENCE = 'conference',
  WORKSHOP = 'workshop',
  MEETUP = 'meetup',
  WEBINAR = 'webinar',
  NETWORKING = 'networking',
}

@Entity('events_read')
export class EventReadModel {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'varchar', length: 200 })
  @Index()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  @IsEnum(EventType)
  type: EventType;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  category: string;

  @Column({ type: 'datetime' })
  @Index()
  startDate: Date;

  @Column({ type: 'datetime' })
  @Index()
  endDate: Date;

  @Column({ type: 'varchar', length: 200 })
  location: string;

  @Column({ type: 'simple-json', nullable: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @Column({ type: 'varchar', length: 36 })
  @Index()
  organizerId: string;

  @Column({ type: 'varchar', length: 200 })
  @Index()
  organizerName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  @IsOptional()
  @IsNumber()
  price?: number;

  @Column({ type: 'int', default: 100 })
  @IsNumber()
  capacity: number;

  @Column({ default: false })
  @Index()
  isFeatured: boolean;


  @Column({ type: 'int', default: 0 })
  @Index()
  @IsNumber()
  registeredCount: number;

  @Column({ type: 'int', default: 0 })
  @Index()
  @IsNumber()
  attendanceCount: number;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  @IsEnum(EventStatus)
  status: EventStatus;

  @Column({ type: 'boolean', default: true })
  @Index()
  isPublic: boolean;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @Column({ type: 'simple-json', nullable: true })
  @IsOptional()
  @IsObject()
  tags?: string[];

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @Column({ type: 'simple-json', nullable: true })
  @IsOptional()
  @IsObject()
  statistics?: {
    views?: number;
    shares?: number;
    favorites?: number;
    avgRating?: number;
  };

  @Column({ default: false })
  @Index()
  isDeleted: boolean;

  @Column({ type: 'int' })
  @Index()
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  @Index()
  lastActivityAt?: Date;
}
