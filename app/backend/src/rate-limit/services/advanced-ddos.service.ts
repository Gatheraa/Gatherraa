import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { BlockedIp } from '../entities/blocked-ip.entity';
import { ApiUsageLog } from '../entities/api-usage-log.entity';
import { Redis } from 'ioredis';
import { subMinutes, subHours, addMinutes } from 'date-fns';

export interface DdosDetectionResult {
  isBlocked: boolean;
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reason?: string;
  blockDuration?: number;
  violationCount: number;
}

export interface SuspiciousPattern {
  ipAddress: string;
  pattern: string;
  severity: number;
  details: Record<string, any>;
}

@Injectable()
export class AdvancedDdosService {
  private readonly logger = new Logger(AdvancedDdosService.name);
  private readonly redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

  constructor(
    @InjectRepository(BlockedIp)
    private blockedIpRepository: Repository<BlockedIp>,
    @InjectRepository(ApiUsageLog)
    private usageLogRepository: Repository<ApiUsageLog>,
  ) {}

  /**
   * Analyze request for DDoS patterns and block if necessary
   */
  async analyzeRequest(
    ipAddress: string,
    endpoint: string,
    userAgent?: string
  ): Promise<DdosDetectionResult> {
    // Check if IP is already blocked
    const isCurrentlyBlocked = await this.isIpBlocked(ipAddress);
    if (isCurrentlyBlocked) {
      return {
        isBlocked: true,
        threatLevel: 'CRITICAL',
        reason: 'IP already blocked',
        violationCount: await this.getViolationCount(ipAddress)
      };
    }

    // Analyze various DDoS patterns
    const analyses = await Promise.all([
      this.analyzeRequestRate(ipAddress),
      this.analyzeEndpointFlooding(ipAddress, endpoint),
      this.analyzeDistributedAttack(ipAddress, userAgent),
      this.analyzeSuspiciousPatterns(ipAddress),
      this.analyzeGeographicAnomalies(ipAddress)
    ]);

    // Calculate overall threat level
    const threatLevel = this.calculateThreatLevel(analyses);
    const shouldBlock = threatLevel === 'HIGH' || threatLevel === 'CRITICAL';

    if (shouldBlock) {
      await this.blockIp(ipAddress, 'DDOS_DETECTION', {
        threatLevel,
        analyses,
        endpoint,
        userAgent
      });
    }

    return {
      isBlocked: shouldBlock,
      threatLevel,
      reason: shouldBlock ? 'DDoS pattern detected' : undefined,
      blockDuration: shouldBlock ? this.getBlockDuration(threatLevel) : undefined,
      violationCount: await this.getViolationCount(ipAddress)
    };
  }

  /**
   * Check if an IP is blocked
   */
  async isIpBlocked(ipAddress: string): Promise<boolean> {
    // Check Redis first for performance
    const redisResult = await this.redis.get(`blocked:${ipAddress}`);
    if (redisResult) {
      return true;
    }

    // Check database
    const blockedIp = await this.blockedIpRepository.findOne({
      where: {
        ipAddress,
        isActive: true,
        expiresAt: MoreThan(new Date())
      }
    });

    if (blockedIp) {
      // Cache in Redis for faster lookups
      const ttl = Math.floor((blockedIp.expiresAt.getTime() - Date.now()) / 1000);
      await this.redis.setex(`blocked:${ipAddress}`, ttl, '1');
      return true;
    }

    return false;
  }

  /**
   * Manually block an IP address
   */
  async blockIp(
    ipAddress: string,
    reason: string = 'MANUAL',
    metadata?: Record<string, any>,
    duration?: number
  ): Promise<void> {
    const blockDuration = duration || 3600; // Default 1 hour
    const expiresAt = addMinutes(new Date(), blockDuration);

    // Check if already blocked
    const existingBlock = await this.blockedIpRepository.findOne({
      where: { ipAddress, isActive: true }
    });

    if (existingBlock) {
      // Update existing block
      existingBlock.expiresAt = expiresAt;
      existingBlock.violationCount += 1;
      existingBlock.metadata = { ...existingBlock.metadata, ...metadata };
      await this.blockedIpRepository.save(existingBlock);
    } else {
      // Create new block
      const block = this.blockedIpRepository.create({
        ipAddress,
        blockType: reason as any,
        reason: metadata?.reason || reason,
        metadata,
        violationCount: 1,
        blockedAt: new Date(),
        expiresAt,
        isActive: true
      });
      await this.blockedIpRepository.save(block);
    }

    // Cache in Redis
    await this.redis.setex(`blocked:${ipAddress}`, blockDuration, '1');

    this.logger.warn(`Blocked IP ${ipAddress} for reason: ${reason}`);
  }

  /**
   * Unblock an IP address
   */
  async unblockIp(ipAddress: string, unblockedBy: string): Promise<void> {
    const blockedIp = await this.blockedIpRepository.findOne({
      where: { ipAddress, isActive: true }
    });

    if (!blockedIp) {
      return;
    }

    blockedIp.isActive = false;
    blockedIp.unblockedAt = new Date();
    blockedIp.unblockedBy = unblockedBy;

    await this.blockedIpRepository.save(blockedIp);

    // Remove from Redis cache
    await this.redis.del(`blocked:${ipAddress}`);

    this.logger.log(`Unblocked IP ${ipAddress} by ${unblockedBy}`);
  }

  /**
   * Get list of blocked IPs
   */
  async getBlockedIps(options: {
    page?: number;
    limit?: number;
    blockType?: string;
    isActive?: boolean;
  } = {}): Promise<{
    ips: BlockedIp[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 50, blockType, isActive } = options;
    const skip = (page - 1) * limit;

    const queryBuilder = this.blockedIpRepository
      .createQueryBuilder('blockedIp')
      .orderBy('blockedIp.blockedAt', 'DESC');

    if (blockType) {
      queryBuilder.andWhere('blockedIp.blockType = :blockType', { blockType });
    }

    if (typeof isActive === 'boolean') {
      queryBuilder.andWhere('blockedIp.isActive = :isActive', { isActive });
    }

    const [ips, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { ips, total, page, limit };
  }

  /**
   * Analyze request rate for potential DDoS
   */
  private async analyzeRequestRate(ipAddress: string): Promise<{
    detected: boolean;
    severity: number;
    details: Record<string, any>;
  }> {
    const now = new Date();
    const timeWindows = [
      { name: '1min', start: subMinutes(now, 1), threshold: 60 },
      { name: '5min', start: subMinutes(now, 5), threshold: 200 },
      { name: '15min', start: subMinutes(now, 15), threshold: 500 }
    ];

    const results = [];
    let maxSeverity = 0;

    for (const window of timeWindows) {
      const count = await this.usageLogRepository.count({
        where: {
          ipAddress,
          timestamp: Between(window.start, now)
        }
      });

      const severity = Math.min(count / window.threshold, 5);
      maxSeverity = Math.max(maxSeverity, severity);

      results.push({
        window: window.name,
        count,
        threshold: window.threshold,
        severity
      });
    }

    return {
      detected: maxSeverity > 2,
      severity: maxSeverity,
      details: { requestRateAnalysis: results }
    };
  }

  /**
   * Analyze endpoint-specific flooding
   */
  private async analyzeEndpointFlooding(
    ipAddress: string,
    endpoint: string
  ): Promise<{
    detected: boolean;
    severity: number;
    details: Record<string, any>;
  }> {
    const now = new Date();
    const start = subMinutes(now, 5);

    const count = await this.usageLogRepository.count({
      where: {
        ipAddress,
        endpoint,
        timestamp: Between(start, now)
      }
    });

    const threshold = 50; // 50 requests to same endpoint in 5 minutes
    const severity = Math.min(count / threshold, 5);

    return {
      detected: count > threshold,
      severity,
      details: { endpoint, count, threshold }
    };
  }

  /**
   * Analyze for distributed attack patterns
   */
  private async analyzeDistributedAttack(
    ipAddress: string,
    userAgent?: string
  ): Promise<{
    detected: boolean;
    severity: number;
    details: Record<string, any>;
  }> {
    if (!userAgent) {
      return { detected: false, severity: 0, details: {} };
    }

    const now = new Date();
    const start = subMinutes(now, 10);

    // Check if same user agent from many IPs
    const userAgentCount = await this.usageLogRepository
      .createQueryBuilder('usage')
      .select('COUNT(DISTINCT usage.ipAddress)', 'uniqueIps')
      .where('usage.userAgent = :userAgent', { userAgent })
      .andWhere('usage.timestamp BETWEEN :start AND :now', { start, now })
      .getRawOne();

    const uniqueIps = parseInt(userAgentCount?.uniqueIps || '0');
    const threshold = 100; // Same user agent from 100+ IPs
    const severity = Math.min(uniqueIps / threshold, 5);

    return {
      detected: uniqueIps > threshold,
      severity,
      details: { userAgent, uniqueIps, threshold }
    };
  }

  /**
   * Analyze suspicious patterns
   */
  private async analyzeSuspiciousPatterns(
    ipAddress: string
  ): Promise<{
    detected: boolean;
    severity: number;
    details: Record<string, any>;
  }> {
    const patterns = await Promise.all([
      this.detectRapidUserAgentChange(ipAddress),
      this.detectUnusualEndpointSequence(ipAddress),
      this.detectTimingPatterns(ipAddress)
    ]);

    const maxSeverity = Math.max(...patterns.map(p => p.severity));
    const detected = patterns.some(p => p.detected);

    return {
      detected,
      severity: maxSeverity,
      details: { patterns }
    };
  }

  /**
   * Analyze geographic anomalies
   */
  private async analyzeGeographicAnomalies(
    ipAddress: string
  ): Promise<{
    detected: boolean;
    severity: number;
    details: Record<string, any>;
  }> {
    // This would integrate with a GeoIP service
    // For now, return a placeholder implementation
    return {
      detected: false,
      severity: 0,
      details: { message: 'GeoIP analysis not implemented' }
    };
  }

  /**
   * Calculate overall threat level
   */
  private calculateThreatLevel(analyses: any[]): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const maxSeverity = Math.max(...analyses.map(a => a.severity));
    
    if (maxSeverity >= 4) return 'CRITICAL';
    if (maxSeverity >= 3) return 'HIGH';
    if (maxSeverity >= 2) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Get block duration based on threat level
   */
  private getBlockDuration(threatLevel: string): number {
    const durations = {
      'LOW': 300,      // 5 minutes
      'MEDIUM': 1800,  // 30 minutes
      'HIGH': 7200,    // 2 hours
      'CRITICAL': 86400 // 24 hours
    };

    return durations[threatLevel] || 3600;
  }

  /**
   * Get violation count for IP
   */
  private async getViolationCount(ipAddress: string): Promise<number> {
    const blockedIp = await this.blockedIpRepository.findOne({
      where: { ipAddress }
    });

    return blockedIp?.violationCount || 0;
  }

  /**
   * Detect rapid user agent changes
   */
  private async detectRapidUserAgentChange(
    ipAddress: string
  ): Promise<{ detected: boolean; severity: number; details: any }> {
    const now = new Date();
    const start = subMinutes(now, 10);

    const userAgents = await this.usageLogRepository
      .createQueryBuilder('usage')
      .select('DISTINCT usage.userAgent')
      .where('usage.ipAddress = :ipAddress', { ipAddress })
      .andWhere('usage.timestamp BETWEEN :start AND :now', { start, now })
      .getRawMany();

    const userAgentCount = userAgents.length;
    const threshold = 5; // 5+ different user agents in 10 minutes
    const severity = Math.min(userAgentCount / threshold, 5);

    return {
      detected: userAgentCount > threshold,
      severity,
      details: { userAgentCount, threshold }
    };
  }

  /**
   * Detect unusual endpoint access sequences
   */
  private async detectUnusualEndpointSequence(
    ipAddress: string
  ): Promise<{ detected: boolean; severity: number; details: any }> {
    const now = new Date();
    const start = subMinutes(now, 5);

    const endpoints = await this.usageLogRepository
      .createQueryBuilder('usage')
      .select('usage.endpoint')
      .where('usage.ipAddress = :ipAddress', { ipAddress })
      .andWhere('usage.timestamp BETWEEN :start AND :now', { start, now })
      .orderBy('usage.timestamp', 'ASC')
      .getMany();

    // Simple pattern detection: rapid access to many different endpoints
    const uniqueEndpoints = new Set(endpoints.map(e => e.endpoint)).size;
    const threshold = 20; // 20+ different endpoints in 5 minutes
    const severity = Math.min(uniqueEndpoints / threshold, 5);

    return {
      detected: uniqueEndpoints > threshold,
      severity,
      details: { uniqueEndpoints, threshold }
    };
  }

  /**
   * Detect timing-based attack patterns
   */
  private async detectTimingPatterns(
    ipAddress: string
  ): Promise<{ detected: boolean; severity: number; details: any }> {
    const now = new Date();
    const start = subMinutes(now, 1);

    const requests = await this.usageLogRepository
      .createQueryBuilder('usage')
      .select('usage.timestamp')
      .where('usage.ipAddress = :ipAddress', { ipAddress })
      .andWhere('usage.timestamp BETWEEN :start AND :now', { start, now })
      .orderBy('usage.timestamp', 'ASC')
      .getMany();

    if (requests.length < 10) {
      return { detected: false, severity: 0, details: {} };
    }

    // Calculate intervals between requests
    const intervals = [];
    for (let i = 1; i < requests.length; i++) {
      const interval = requests[i].timestamp.getTime() - requests[i-1].timestamp.getTime();
      intervals.push(interval);
    }

    // Check for very regular intervals (potential bot)
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => {
      return sum + Math.pow(interval - avgInterval, 2);
    }, 0) / intervals.length;
    
    const regularityScore = 1 / (variance / avgInterval + 1);
    const severity = Math.min(regularityScore * 5, 5);

    return {
      detected: regularityScore > 3,
      severity,
      details: { avgInterval, variance, regularityScore }
    };
  }

  /**
   * Clean up expired blocks
   */
  async cleanupExpiredBlocks(): Promise<void> {
    const expiredBlocks = await this.blockedIpRepository.find({
      where: {
        isActive: true,
        expiresAt: MoreThan(new Date())
      }
    });

    for (const block of expiredBlocks) {
      block.isActive = false;
      block.unblockedAt = new Date();
      block.unblockedBy = 'SYSTEM';
      await this.blockedIpRepository.save(block);

      // Remove from Redis
      await this.redis.del(`blocked:${block.ipAddress}`);
    }

    if (expiredBlocks.length > 0) {
      this.logger.log(`Cleaned up ${expiredBlocks.length} expired IP blocks`);
    }
  }
}
