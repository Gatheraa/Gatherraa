import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Tag } from './tag.entity';

@Entity('tag_usage')
export class TagUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tag, { onDelete: 'CASCADE' })
  tag: Tag;

  @Column()
  eventId: string;

  @CreateDateColumn()
  createdAt: Date;
}