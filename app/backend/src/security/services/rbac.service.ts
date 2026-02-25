import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import { 
  Permission, 
  Role, 
  UserRole, 
  RoleHierarchy, 
  PermissionPolicy,
  PermissionType,
  ResourceType,
  RoleType 
} from '../entities/rbac.entity';
import { User } from '../../users/entities/user.entity';
import { SecurityAuditService } from './security-audit.service';

export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
  conditions?: any;
  policy?: string;
}

export interface RoleAssignment {
  userId: string;
  roleId: string;
  context?: any;
  assignedBy?: string;
  expiresAt?: Date;
}

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(RoleHierarchy)
    private readonly roleHierarchyRepository: Repository<RoleHierarchy>,
    @InjectRepository(PermissionPolicy)
    private readonly policyRepository: Repository<PermissionPolicy>,
    private readonly auditService: SecurityAuditService,
  ) {}

  async createPermission(
    name: string,
    type: PermissionType,
    resource: ResourceType,
    description?: string,
    conditions?: any
  ): Promise<Permission> {
    const existingPermission = await this.permissionRepository.findOne({
      where: { name },
    });

    if (existingPermission) {
      throw new BadRequestException(`Permission ${name} already exists`);
    }

    const permission = this.permissionRepository.create({
      name,
      description: description || `${type} access to ${resource}`,
      type,
      resource,
      conditions,
    });

    return this.permissionRepository.save(permission);
  }

  async createRole(
    name: string,
    description: string,
    permissionIds: string[],
    type: RoleType = RoleType.CUSTOM,
    metadata?: any
  ): Promise<Role> {
    const existingRole = await this.roleRepository.findOne({
      where: { name },
      relations: ['permissions'],
    });

    if (existingRole) {
      throw new BadRequestException(`Role ${name} already exists`);
    }

    const permissions = await this.permissionRepository.findBy({
      id: In(permissionIds),
    });

    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException('Some permissions not found');
    }

    const role = this.roleRepository.create({
      name,
      description,
      type,
      permissions,
      metadata,
    });

    return this.roleRepository.save(role);
  }

  async assignRoleToUser(
    assignment: RoleAssignment,
    metadata?: any
  ): Promise<UserRole> {
    const existingAssignment = await this.userRoleRepository.findOne({
      where: {
        userId: assignment.userId,
        roleId: assignment.roleId,
        isActive: true,
      },
    });

    if (existingAssignment) {
      throw new BadRequestException('User already has this role assigned');
    }

    const userRole = this.userRoleRepository.create({
      userId: assignment.userId,
      roleId: assignment.roleId,
      context: {
        assignedBy: assignment.assignedBy,
        assignedAt: new Date(),
        expiresAt: assignment.expiresAt,
        ...assignment.context,
      },
    });

    const savedUserRole = await this.userRoleRepository.save(userRole);

    // Log audit event
    await this.auditService.logEvent({
      userId: assignment.assignedBy,
      action: 'ROLE_ASSIGNED',
      resource: 'user_role',
      resourceId: savedUserRole.id,
      details: {
        targetUserId: assignment.userId,
        roleId: assignment.roleId,
        context: assignment.context,
      },
      ...metadata,
    });

    return savedUserRole;
  }

  async removeRoleFromUser(
    userId: string,
    roleId: string,
    removedBy?: string,
    metadata?: any
  ): Promise<boolean> {
    const userRole = await this.userRoleRepository.findOne({
      where: { userId, roleId, isActive: true },
    });

    if (!userRole) {
      throw new NotFoundException('Role assignment not found');
    }

    userRole.isActive = false;
    await this.userRoleRepository.save(userRole);

    // Log audit event
    await this.auditService.logEvent({
      userId: removedBy,
      action: 'ROLE_REMOVED',
      resource: 'user_role',
      resourceId: userRole.id,
      details: {
        targetUserId: userId,
        roleId,
      },
      ...metadata,
    });

    return true;
  }

  async checkPermission(
    userId: string,
    action: PermissionType,
    resource: ResourceType,
    resourceId?: string,
    context?: any
  ): Promise<AccessCheckResult> {
    // Get user's active roles
    const userRoles = await this.getUserRoles(userId);
    
    if (userRoles.length === 0) {
      return { allowed: false, reason: 'No roles assigned' };
    }

    // Check permission policies first (deny overrides allow)
    const policyResult = await this.checkPolicies(userId, action, resource, context);
    if (!policyResult.allowed && policyResult.reason) {
      return policyResult;
    }

    // Get all permissions from roles (including inherited)
    const permissions = await this.getRolePermissions(userRoles.map(ur => ur.roleId));

    // Find matching permissions
    const matchingPermissions = permissions.filter(permission => {
      if (permission.type !== action || permission.resource !== resource) {
        return false;
      }

      // Check conditions if any
      if (permission.conditions) {
        return this.evaluateConditions(permission.conditions, resourceId, context);
      }

      return true;
    });

    if (matchingPermissions.length === 0) {
      return { allowed: false, reason: 'No matching permissions found' };
    }

    // Check if any permission has deny conditions
    const deniedPermissions = matchingPermissions.filter(p => 
      p.conditions && p.conditions.effect === 'deny'
    );

    if (deniedPermissions.length > 0) {
      return { 
        allowed: false, 
        reason: 'Access denied by permission conditions',
        policy: deniedPermissions[0].name,
      };
    }

    return { 
      allowed: true, 
      conditions: matchingPermissions[0].conditions,
    };
  }

  async hasPermission(
    userId: string,
    action: PermissionType,
    resource: ResourceType,
    resourceId?: string,
    context?: any
  ): Promise<boolean> {
    const result = await this.checkPermission(userId, action, resource, resourceId, context);
    return result.allowed;
  }

  async getUserRoles(userId: string): Promise<UserRole[]> {
    return this.userRoleRepository.find({
      where: { 
        userId, 
        isActive: true,
      },
      relations: ['role'],
      order: { createdAt: 'DESC' },
    });
  }

  async getRolePermissions(roleIds: string[]): Promise<Permission[]> {
    // Get direct permissions
    const roles = await this.roleRepository.find({
      where: { id: In(roleIds), isActive: true },
      relations: ['permissions'],
    });

    let permissions = roles.flatMap(role => role.permissions);

    // Get inherited permissions through hierarchy
    for (const roleId of roleIds) {
      const inheritedPermissions = await this.getInheritedPermissions(roleId);
      permissions = [...permissions, ...inheritedPermissions];
    }

    // Remove duplicates
    const uniquePermissions = permissions.filter((permission, index, self) =>
      index === self.findIndex(p => p.id === permission.id)
    );

    return uniquePermissions;
  }

  async createRoleHierarchy(
    parentRoleId: string,
    childRoleId: string,
    level: number = 1
  ): Promise<RoleHierarchy> {
    const existingHierarchy = await this.roleHierarchyRepository.findOne({
      where: { parentRoleId, childRoleId },
    });

    if (existingHierarchy) {
      throw new BadRequestException('Role hierarchy already exists');
    }

    const hierarchy = this.roleHierarchyRepository.create({
      parentRoleId,
      childRoleId,
      level,
    });

    return this.roleHierarchyRepository.save(hierarchy);
  }

  async createPolicy(
    name: string,
    description: string,
    rules: any,
    priority: number = 0
  ): Promise<PermissionPolicy> {
    const existingPolicy = await this.policyRepository.findOne({
      where: { name },
    });

    if (existingPolicy) {
      throw new BadRequestException(`Policy ${name} already exists`);
    }

    const policy = this.policyRepository.create({
      name,
      description,
      rules,
      priority,
    });

    return this.policyRepository.save(policy);
  }

  async getUserPermissions(userId: string): Promise<Permission[]> {
    const userRoles = await this.getUserRoles(userId);
    const roleIds = userRoles.map(ur => ur.roleId);
    return this.getRolePermissions(roleIds);
  }

  async getEffectivePermissions(userId: string): Promise<{
    permissions: Permission[];
    roles: Role[];
    policies: PermissionPolicy[];
  }> {
    const userRoles = await this.getUserRoles(userId);
    const roles = userRoles.map(ur => ur.role);
    const permissions = await this.getRolePermissions(userRoles.map(ur => ur.roleId));
    const policies = await this.getActivePolicies();

    return {
      permissions,
      roles,
      policies,
    };
  }

  private async getInheritedPermissions(roleId: string): Promise<Permission[]> {
    const hierarchies = await this.roleHierarchyRepository.find({
      where: { parentRoleId: roleId },
      relations: ['childRole', 'childRole.permissions'],
    });

    let permissions: Permission[] = [];

    for (const hierarchy of hierarchies) {
      permissions = [...permissions, ...hierarchy.childRole.permissions];
      
      // Recursively get inherited permissions
      const inherited = await this.getInheritedPermissions(hierarchy.childRoleId);
      permissions = [...permissions, ...inherited];
    }

    return permissions;
  }

  private async checkPolicies(
    userId: string,
    action: PermissionType,
    resource: ResourceType,
    context?: any
  ): Promise<AccessCheckResult> {
    const policies = await this.getActivePolicies();

    // Sort by priority (higher priority first)
    policies.sort((a, b) => b.priority - a.priority);

    for (const policy of policies) {
      const { rules } = policy;

      // Check if policy applies to this action and resource
      if (!rules.actions.includes(action) || !rules.resources.includes(resource)) {
        continue;
      }

      // Check conditions
      if (rules.conditions) {
        const conditionsMet = await this.evaluatePolicyConditions(
          rules.conditions,
          userId,
          context
        );

        if (!conditionsMet) {
          continue;
        }
      }

      // Policy matched
      return {
        allowed: rules.effect === 'allow',
        reason: `Policy ${policy.name} - ${rules.effect}`,
        policy: policy.name,
      };
    }

    return { allowed: true }; // Default allow if no policies match
  }

  private async evaluatePolicyConditions(
    conditions: any,
    userId: string,
    context?: any
  ): Promise<boolean> {
    // IP address check
    if (conditions.ip && context?.ipAddress) {
      if (!conditions.ip.includes(context.ipAddress)) {
        return false;
      }
    }

    // Time-based check
    if (conditions.time) {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      
      if (conditions.time.start) {
        const [startHour, startMin] = conditions.time.start.split(':').map(Number);
        const startTime = startHour * 60 + startMin;
        if (currentTime < startTime) return false;
      }
      
      if (conditions.time.end) {
        const [endHour, endMin] = conditions.time.end.split(':').map(Number);
        const endTime = endHour * 60 + endMin;
        if (currentTime > endTime) return false;
      }
      
      if (conditions.time.days && !conditions.time.days.includes(now.getDay())) {
        return false;
      }
    }

    // Risk level check
    if (conditions.risk && context?.riskLevel) {
      if (context.riskLevel !== conditions.risk) {
        return false;
      }
    }

    return true;
  }

  private evaluateConditions(
    conditions: any,
    resourceId?: string,
    context?: any
  ): boolean {
    // Simple condition evaluation - in production, this would be more sophisticated
    if (conditions.field && conditions.operator && conditions.value) {
      const fieldValue = context?.[conditions.field] || resourceId;
      
      switch (conditions.operator) {
        case 'eq':
          return fieldValue === conditions.value;
        case 'ne':
          return fieldValue !== conditions.value;
        case 'in':
          return Array.isArray(conditions.value) && conditions.value.includes(fieldValue);
        case 'nin':
          return Array.isArray(conditions.value) && !conditions.value.includes(fieldValue);
        case 'contains':
          return String(fieldValue).includes(conditions.value);
        default:
          return true;
      }
    }

    return true;
  }

  private async getActivePolicies(): Promise<PermissionPolicy[]> {
    return this.policyRepository.find({
      where: { isActive: true },
      order: { priority: 'DESC' },
    });
  }
}
