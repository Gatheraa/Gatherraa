import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Faq } from './faq.entity';

@Entity()
export class FaqCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @OneToMany(() => Faq, (faq) => faq.category)
  faqs: Faq[];
}
