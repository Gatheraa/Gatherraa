import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { ApiKey } from '../entities/api-key.entity';
import { ApiQuota, ApiTier, QuotaPeriod } from '../entities/api-quota.entity';
import { AdvancedQuotaService } from './advanced-quota.service';
import { v4 as uuidv4 } from 'uuid';
import { addMonths } from 'date-fns';

export interface CreateApiKeyDto {
  userId: string;
  name: string;
  description?: string;
  tier: ApiTier;
  permissions: string[];
  rateLimits?: Record<string, any>;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface UpdateApiKeyDto {
  name?: string;
  description?: string;
  tier?: ApiTier;
  permissions?: string[];
  rateLimits?: Record<string, any>;
  expiresAt?: Date;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

export interface ApiKeyUsage {
  totalRequests: number;
  totalCost: number;
  averageResponseTime: number;
  errorRate: number;
  lastUsedAt?: Date;
  quotas: Array<{
    endpoint: string;
    period: string;
    limit: number;
    used: number;
    remaining: number;
    overage: number;
  }>;
}

@Injectable()
export class ApiKeyManagementService {
  private readonly logger = new Logger(ApiKeyManagementService.name);

  constructor(
    @InjectRepository(ApiKey)
    private apiKeyRepository: Repository<ApiKey>,
    @InjectRepository(ApiQuota)
    private quotaRepository: Repository<ApiQuota>,
    private quotaService: AdvancedQuotaService,
  ) {}

  /**
   * Create a new API key
   */
  async createApiKey(createDto: CreateApiKeyDto): Promise<ApiKey> {
    // Check if user has reached API key limit for their tier
    await this.checkApiKeyLimit(createDto.userId, createDto.tier);

    const apiKey = this.apiKeyRepository.create({
      key: this.generateApiKey(),
      userId: createDto.userId,
      name: createDto.name,
      description: createDto.description,
      tier: createDto.tier,
      permissions: createDto.permissions,
      rateLimits: createDto.rateLimits,
      expiresAt: createDto.expiresAt,
      metadata: createDto.metadata,
      isActive: true,
      isRevoked: false
    });

    const savedKey = await this.apiKeyRepository.save(apiKey);

    // Set up default quotas for the new API key
    await this.setupDefaultQuotas(savedKey);

    this.logger.log(`Created API key ${savedKey.id} for user ${createDto.userId}`);
    return savedKey;
  }

  /**
   * Update an existing API key
   */
  async updateApiKey(keyId: string, updateDto: UpdateApiKeyDto): Promise<ApiKey> {
    const apiKey = await this.apiKeyRepository.findOne({ where: { id: keyId } });
    
    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    // Apply updates
    Object.assign(apiKey, updateDto);

    const updatedKey = await this.apiKeyRepository.save(apiKey);

    // Update quotas if tier changed
    if (updateDto.tier && updateDto.tier !== apiKey.tier) {
      await this.updateQuotasForTierChange(updatedKey);
    }

    this.logger.log(`Updated API key ${keyId}`);
    return updatedKey;
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: string, reason: string): Promise<void> {
    const apiKey = await this.apiKeyRepository.findOne({ where: { id: keyId } });
    
    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    apiKey.isRevoked = true;
    apiKey.revokedReason = reason;
    apiKey.isActive = false;

    await this.apiKeyRepository.save(apiKey);

    this.logger.log(`Revoked API key ${keyId} for reason: ${reason}`);
  }

  /**
   * Get API key by key value
   */
  async getApiKeyByKey(key: string): Promise<ApiKey | null> {
    return await this.apiKeyRepository.findOne({ 
      where: { 
        key, 
        isActive: true, 
        isRevoked: false 
      } 
    });
  }

  /**
   * Get API key with usage statistics
   */
  async getApiKeyWithUsage(keyId: string): Promise<{ apiKey: ApiKey; usage: ApiKeyUsage }> {
    const apiKey = await this.apiKeyRepository.findOne({ where: { id: keyId } });
    
    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    const usage = await this.quotaService.getUsageMetrics(
      undefined, // userId
      keyId,     // apiKeyId
      'month'
    );

    const quotas = await this.quotaRepository.find({
      where: { apiKeyId: keyId, isActive: true }
    });

    const quotaDetails = quotas.map(quota => ({
      endpoint: quota.endpoint,
      period: quota.period,
      limit: quota.limit,
      used: quota.used,
      remaining: Math.max(0, quota.limit - quota.used),
      overage: quota.overage
    }));

    return {
      apiKey,
      usage: {
        ...usage,
        lastUsedAt: apiKey.lastUsedAt,
        quotas: quotaDetails
      }
    };
  }

  /**
   * List API keys for a user
   */
  async listApiKeys(
    userId: string, 
    options: {
      page?: number;
      limit?: number;
      search?: string;
      tier?: ApiTier;
      isActive?: boolean;
    } = {}
  ): Promise<{ keys: ApiKey[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 20, search, tier, isActive } = options;
    const skip = (page - 1) * limit;

    const queryBuilder = this.apiKeyRepository
      .createQueryBuilder('apiKey')
      .where('apiKey.userId = :userId', { userId });

    if (search) {
      queryBuilder.andWhere('apiKey.name LIKE :search', { search: `%${search}%` });
    }

    if (tier) {
      queryBuilder.andWhere('apiKey.tier = :tier', { tier });
    }

    if (typeof isActive === 'boolean') {
      queryBuilder.andWhere('apiKey.isActive = :isActive', { isActive });
    }

    const [keys, total] = await queryBuilder
      .orderBy('apiKey.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { keys, total, page, limit };
  }

  /**
   * Validate API key and check permissions
   */
  async validateApiKey(key: string, requiredPermission?: string): Promise<{
    valid: boolean;
    apiKey?: ApiKey;
    error?: string;
  }> {
    const apiKey = await this.getApiKeyByKey(key);
    
    if (!apiKey) {
      return { valid: false, error: 'Invalid API key' };
    }

    if (apiKey.isRevoked) {
      return { valid: false, error: 'API key has been revoked' };
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return { valid: false, error: 'API key has expired' };
    }

    if (!apiKey.isActive) {
      return { valid: false, error: 'API key is inactive' };
    }

    if (requiredPermission && !apiKey.permissions.includes(requiredPermission)) {
      return { valid: false, error: 'Insufficient permissions' };
    }

    // Update last used timestamp
    await this.updateLastUsed(apiKey.id);

    return { valid: true, apiKey };
  }

  /**
   * Generate billing report for API keys
   */
  async generateBillingReport(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalCost: number;
    breakdown: Array<{
      apiKeyId: string;
      apiKeyName: string;
      tier: string;
      requests: number;
      cost: number;
      overageCost: number;
    }>;
  }> {
    const apiKeys = await this.apiKeyRepository.find({
      where: { userId }
    });

    const breakdown = [];
    let totalCost = 0;

    for (const apiKey of apiKeys) {
      const usage = await this.quotaService.getUsageMetrics(
        userId,
        apiKey.id,
        'month'
      );

      const cost = usage.totalCost;
      const overageCost = await this.calculateOverageCost(apiKey.id, startDate, endDate);

      breakdown.push({
        apiKeyId: apiKey.id,
        apiKeyName: apiKey.name,
        tier: apiKey.tier,
        requests: usage.totalRequests,
        cost,
        overageCost
      });

      totalCost += cost + overageCost;
    }

    return { totalCost, breakdown };
  }

  /**
   * Rotate API key (generate new key, invalidate old one)
   */
  async rotateApiKey(keyId: string): Promise<{ newKey: string; oldKey: string }> {
    const apiKey = await this.apiKeyRepository.findOne({ where: { id: keyId } });
    
    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    const oldKey = apiKey.key;
    const newKey = this.generateApiKey();

    apiKey.key = newKey;
    await this.apiKeyRepository.save(apiKey);

    this.logger.log(`Rotated API key ${keyId}`);

    return { newKey, oldKey };
  }

  /**
   * Get API key statistics
   */
  async getApiKeyStatistics(userId?: string): Promise<{
    totalKeys: number;
    activeKeys: number;
    keysByTier: Record<string, number>;
    totalRequests: number;
    totalCost: number;
  }> {
    const queryBuilder = this.apiKeyRepository.createQueryBuilder('apiKey');
    
    if (userId) {
      queryBuilder.where('apiKey.userId = :userId', { userId });
    }

    const keys = await queryBuilder.getMany();

    const keysByTier = keys.reduce((acc, key) => {
      acc[key.tier] = (acc[key.tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalRequests = keys.reduce((sum, key) => sum + key.totalRequests, 0);
    const totalCost = keys.reduce((sum, key) => sum + key.totalCost, 0);

    return {
      totalKeys: keys.length,
      activeKeys: keys.filter(k => k.isActive && !k.isRevoked).length,
      keysByTier,
      totalRequests,
      totalCost
    };
  }

  /**
   * Generate a secure API key
   */
  private generateApiKey(): string {
    const prefix = 'gath_';
    const randomPart = uuidv4().replace(/-/g, '');
    return `${prefix}${randomPart}`;
  }

  /**
   * Check if user has reached API key limit
   */
  private async checkApiKeyLimit(userId: string, tier: ApiTier): Promise<void> {
    const existingKeys = await this.apiKeyRepository.count({
      where: { userId, isActive: true, isRevoked: false }
    });

    const limits = {
      [ApiTier.FREE]: 2,
      [ApiTier.BASIC]: 5,
      [ApiTier.PROFESSIONAL]: 10,
      [ApiTier.ENTERPRISE]: 25,
      [ApiTier.CUSTOM]: 50
    };

    const maxKeys = limits[tier] || limits[ApiTier.FREE];

    if (existingKeys >= maxKeys) {
      throw new BadRequestException(
        `Maximum API key limit (${maxKeys}) reached for ${tier} tier`
      );
    }
  }

  /**
   * Set up default quotas for new API key
   */
  private async setupDefaultQuotas(apiKey: ApiKey): Promise<void> {
    const defaultEndpoints = ['GET', 'POST', 'PUT', 'DELETE'];
    const defaultPeriods = [QuotaPeriod.MINUTE, QuotaPeriod.HOUR, QuotaPeriod.DAY];

    for (const endpoint of defaultEndpoints) {
      for (const period of defaultPeriods) {
        await this.quotaService.setQuota(
          apiKey.userId,
          endpoint,
          apiKey.tier,
          period,
          this.getDefaultLimit(apiKey.tier, period)
        );
      }
    }
  }

  /**
   * Get default limit for tier and period
   */
  private getDefaultLimit(tier: ApiTier, period: QuotaPeriod): number {
    const limits = {
      [ApiTier.FREE]: {
        [QuotaPeriod.MINUTE]: 10,
        [QuotaPeriod.HOUR]: 100,
        [QuotaPeriod.DAY]: 1000
      },
      [ApiTier.BASIC]: {
        [QuotaPeriod.MINUTE]: 60,
        [QuotaPeriod.HOUR]: 1000,
        [QuotaPeriod.DAY]: 10000
      },
      [ApiTier.PROFESSIONAL]: {
        [QuotaPeriod.MINUTE]: 300,
        [QuotaPeriod.HOUR]: 5000,
        [QuotaPeriod.DAY]: 50000
      },
      [ApiTier.ENTERPRISE]: {
        [QuotaPeriod.MINUTE]: 1000,
        [QuotaPeriod.HOUR]: 20000,
        [QuotaPeriod.DAY]: 200000
      },
      [ApiTier.CUSTOM]: {
        [QuotaPeriod.MINUTE]: 2000,
        [QuotaPeriod.HOUR]: 50000,
        [QuotaPeriod.DAY]: 500000
      }
    };

    return limits[tier]?.[period] || limits[ApiTier.FREE][period];
  }

  /**
   * Update quotas when tier changes
   */
  private async updateQuotasForTierChange(apiKey: ApiKey): Promise<void> {
    // Deactivate old quotas
    await this.quotaRepository
      .createQueryBuilder()
      .update(ApiQuota)
      .set({ isActive: false })
      .where('apiKeyId = :apiKeyId', { apiKeyId: apiKey.id })
      .execute();

    // Create new quotas with updated tier limits
    await this.setupDefaultQuotas(apiKey);
  }

  /**
   * Update last used timestamp
   */
  private async updateLastUsed(keyId: string): Promise<void> {
    await this.apiKeyRepository
      .createQueryBuilder()
      .update(ApiKey)
      .set({ lastUsedAt: new Date() })
      .where('id = :keyId', { keyId })
      .execute();
  }

  /**
   * Calculate overage cost
   */
  private async calculateOverageCost(
    apiKeyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const quotas = await this.quotaRepository.find({
      where: {
        apiKeyId,
        periodStart: Between(startDate, endDate),
        overage: MoreThan(0)
      }
    });

    return quotas.reduce((total, quota) => total + (quota.overage * quota.overageRate), 0);
  }
}
