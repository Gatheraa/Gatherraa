import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { IsNumber, IsString, IsDate, IsBoolean, IsOptional } from 'class-validator';

@Entity('market_trends')
export class MarketTrend {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  category: string; // events, tickets, venues, etc.

  @Column({ type: 'varchar', length: 200, nullable: true })
  @Index()
  subcategory?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index()
  region?: string;

  @Column({ type: 'datetime' })
  @Index()
  timestamp: Date;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  averagePrice: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  minPrice: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  maxPrice: number;

  @Column({ type: 'int' })
  totalVolume: number; // Number of transactions/events

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  totalValue: number; // Total monetary value

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  priceChange?: number; // Price change percentage

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  volumeChange?: number; // Volume change percentage

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>; // Additional trend data

  @Column({ type: 'json', nullable: true })
  seasonality?: Record<string, any>; // Seasonal patterns

  @Column({ type: 'json', nullable: true })
  predictions?: Record<string, any>; // AI/ML predictions

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  confidence?: number; // Confidence score for predictions

  @Column({ type: 'varchar', length: 50, nullable: true })
  @Index()
  dataSource?: string; // Source of the trend data

  @Column({ default: true })
  @Index()
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
