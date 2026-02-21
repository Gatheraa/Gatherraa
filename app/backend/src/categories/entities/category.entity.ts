import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Tree,
  TreeChildren,
  TreeParent,
  Index,
  CreateDateColumn,
} from 'typeorm';

@Tree('closure-table')
@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @TreeChildren()
  children: Category[];

  @TreeParent()
  parent: Category;

  @Column({ default: 0 })
  usageCount: number;

  @CreateDateColumn()
  createdAt: Date;
}