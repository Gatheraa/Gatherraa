import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum UserRole {
  ATTENDEE = 'attendee',
  ORGANIZER = 'organizer',
  ADMIN = 'admin',
}

export enum ProfileVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
}

export interface OAuthProvider {
  provider: string;
  providerId: string;
  accessToken?: string;
  refreshToken?: string;
  username?: string;
  email?: string;
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  firstName: string;

  @Column()
  @Index()
  lastName: string;

  @Column({ unique: true })
  @Index()
  email: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 42, unique: true })
  walletAddress: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  nonce: string | null;

  @Column({ type: 'simple-array', default: UserRole.ATTENDEE })
  roles: UserRole[];

  @Column({ type: 'simple-array', default: '' })
  linkedWallets: string[];

  @Column({ type: 'simple-json', nullable: true })
  oauthProviders: OAuthProvider[];

  @Column({
    type: 'enum',
    enum: ProfileVisibility,
    default: ProfileVisibility.PUBLIC,
  })
  profileVisibility: ProfileVisibility;

  @Column({ type: 'jsonb', nullable: true })
  preferences?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  socialLinks?: {
    twitter?: string;
    linkedin?: string;
    github?: string;
    website?: string;
  };

  @Column({ type: 'varchar', nullable: true })
  username: string;

  @Column({ type: 'varchar', nullable: true })
  avatar: string;

   @Column({ nullable: true })
  bio?: string;

  @Column({ default: 0 })
  profileCompletion: number;

  @Column({ nullable: true })
  avatarUrl?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  lastLoginAt: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
