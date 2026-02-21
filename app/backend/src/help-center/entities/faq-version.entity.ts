import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Faq } from './faq.entity';

@Entity()
export class FaqVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Faq, (faq) => faq.versions)
  faq: Faq;

  @Column('text')
  contentSnapshot: string;

  @Column()
  versionNumber: number;

  @Column()
  createdAt: Date;
}
