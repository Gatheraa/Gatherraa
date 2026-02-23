import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('email_logs')
export class EmailLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  recipient: string;

  @Column()
  subject: string;

  @Column()
  template: string;

  @Column({ nullable: true })
  variant: string;

  @Column({ default: 'SENT' })
  status: string;

  @Column({ nullable: true })
  providerMessageId: string;

  @Column({ nullable: true })
  bounceReason: string;

  @CreateDateColumn()
  createdAt: Date;
}