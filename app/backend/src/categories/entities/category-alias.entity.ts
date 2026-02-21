import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
} from 'typeorm';
import { Category } from './category.entity';

@Entity('category_aliases')
export class CategoryAlias {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  alias: string;

  @ManyToOne(() => Category, (category) => category.id, {
    onDelete: 'CASCADE',
  })
  category: Category;
}