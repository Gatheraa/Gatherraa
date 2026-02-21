import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';

@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  name: string;

  @Column({
    type: 'tsvector',
    select: false,
    nullable: true,
  })
  searchVector: string;

  @Column({ default: 0 })
  usageCount: number;

  @Column({ default: false })
  isMerged: boolean;

  @Column({ nullable: true })
  mergedInto?: string;

  @CreateDateColumn()
  createdAt: Date;
}