import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum PermissionType {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  ADMIN = 'admin',
  EXECUTE = 'execute',
}

export enum ResourceType {
  USER = 'user',
  EVENT = 'event',
  PAYMENT = 'payment',
  TRANSACTION = 'transaction',
  PROPERTY = 'property',
  CONTRACT = 'contract',
  DOCUMENT = 'document',
  AUDIT_LOG = 'audit_log',
  SYSTEM_CONFIG = 'system_config',
  ANALYTICS = 'analytics',
  REPORT = 'report',
  NOTIFICATION = 'notification',
  INTEGRATION = 'integration',
  API_KEY = 'api_key',
  WEBHOOK = 'webhook',
}

export enum RoleType {
  SYSTEM = 'system',
  CUSTOM = 'custom',
  TEMPORARY = 'temporary',
}

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  @Index()
  name: string;

  @Column({ type: 'varchar' })
  description: string;

  @Column({
    type: 'enum',
    enum: PermissionType,
  })
  type: PermissionType;

  @Column({
    type: 'enum',
    enum: ResourceType,
  })
  resource: ResourceType;

  @Column({ type: 'jsonb', nullable: true })
  conditions: {
    field?: string;
    operator?: 'eq' | 'ne' | 'gt' | 'lt' | 'in' | 'nin' | 'contains';
    value?: any;
    customLogic?: string;
  };

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isSystem: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  @Index()
  name: string;

  @Column({ type: 'varchar' })
  description: string;

  @Column({
    type: 'enum',
    enum: RoleType,
    default: RoleType.CUSTOM,
  })
  type: RoleType;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    priority?: number;
    expiresAt?: Date;
    maxUsers?: number;
    isAssignable?: boolean;
    requiresApproval?: boolean;
  };

  @Column({ type: 'boolean', default: true })
  isActive: true;

  @Column({ type: 'boolean', default: false })
  isSystem: boolean;

  @ManyToMany(() => Permission, { cascade: true })
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'roleId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permissionId', referencedColumnName: 'id' },
  })
  permissions: Permission[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('user_roles')
export class UserRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  @Index()
  roleId: string;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roleId' })
  role: Role;

  @Column({ type: 'jsonb', nullable: true })
  context: {
    assignedBy?: string;
    assignedAt?: Date;
    expiresAt?: Date;
    scope?: string[];
    conditions?: any;
    reason?: string;
  };

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('role_hierarchy')
export class RoleHierarchy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  parentRoleId: string;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parentRoleId' })
  parentRole: Role;

  @Column({ type: 'uuid' })
  @Index()
  childRoleId: string;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'childRoleId' })
  childRole: Role;

  @Column({ type: 'int', default: 1 })
  level: number;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('permission_policies')
export class PermissionPolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  @Index()
  name: string;

  @Column({ type: 'varchar' })
  description: string;

  @Column({ type: 'jsonb' })
  rules: {
    effect: 'allow' | 'deny';
    actions: PermissionType[];
    resources: ResourceType[];
    conditions?: {
      ip?: string[];
      time?: {
        start?: string;
        end?: string;
        days?: number[];
      };
      location?: string[];
      device?: string[];
      risk?: 'low' | 'medium' | 'high';
    };
  };

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isSystem: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
