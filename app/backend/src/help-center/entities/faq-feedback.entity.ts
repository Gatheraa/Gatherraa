import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Faq } from './faq.entity';

@Entity()
export class FaqFeedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Faq)
  faq: Faq;

  @Column()
  helpful: boolean;

  @Column({ nullable: true })
  comment: string;

  @Column()
  createdAt: Date;
}
