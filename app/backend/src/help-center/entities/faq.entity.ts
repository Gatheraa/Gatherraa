import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { FaqCategory } from './faq-category.entity';
import { FaqVersion } from './faq-version.entity';


@Entity()
export class Faq {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  content: string;

  @Column({ default: true })
  published: boolean;

  @ManyToOne(() => FaqCategory, (category) => category.faqs)
  category: FaqCategory;

  @OneToMany(() => FaqVersion, (version) => version.faq)
  versions: FaqVersion[];

  @Column('simple-array', { nullable: true })
  relatedArticleIds: string[];

  @Column({ default: 0 })
  helpfulCount: number;

  @Column({ default: 0 })
  notHelpfulCount: number;
}