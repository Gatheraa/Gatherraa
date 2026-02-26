import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan } from 'typeorm';
import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  Index,
  ManyToOne,
  JoinColumn 
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { SecurityAuditService, AuditEventType } from './security-audit.service';

export enum AnomalyType {
  UNUSUAL_LOGIN_TIME = 'unusual_login_time',
  UNUSUAL_LOCATION = 'unusual_location',
  RAPID_SUCCESSIVE_ATTEMPTS = 'rapid_successive_attempts',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  DATA_EXFILTRATION = 'data_exfiltration',
  BRUTE_FORCE_ATTEMPT = 'brute_force_attempt',
  SUSPICIOUS_API_USAGE = 'suspicious_api_usage',
  ABNORMAL_BEHAVIOR = 'abnormal_behavior',
  MALICIOUS_PAYLOAD = 'malicious_payload',
  COMPROMISED_ACCOUNT = 'compromised_account',
}

export enum ThreatLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum AlertStatus {
  NEW = 'new',
  INVESTIGATING = 'investigating',
  RESOLVED = 'resolved',
  FALSE_POSITIVE = 'false_positive',
  ESCALATED = 'escalated',
}

@Entity('security_anomalies')
export class SecurityAnomaly {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: AnomalyType,
  })
  @Index()
  anomalyType: AnomalyType;

  @Column({
    type: 'enum',
    enum: ThreatLevel,
  })
  @Index()
  threatLevel: ThreatLevel;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb' })
  anomalyData: {
    triggeredBy: string;
    threshold: number;
    actualValue: number;
    timeWindow: string;
    baseline: number;
    confidence: number;
    patterns: Array<{
      type: string;
      description: string;
      weight: number;
    }>;
  };

  @Column({ type: 'jsonb', nullable: true })
  context: {
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    requestId?: string;
    geolocation?: {
      country?: string;
      city?: string;
      coordinates?: [number, number];
    };
    deviceFingerprint?: string;
    previousActivity?: Array<{
      timestamp: Date;
      action: string;
      details: any;
    }>;
  };

  @Column({
    type: 'enum',
    enum: AlertStatus,
    default: AlertStatus.NEW,
  })
  @Index()
  status: AlertStatus;

  @Column({ type: 'jsonb', nullable: true })
  investigation: {
    assignedTo?: string;
    assignedAt?: Date;
    notes?: string;
    actions?: Array<{
      action: string;
      performedBy: string;
      performedAt: Date;
      details?: string;
    }>;
    resolution?: string;
    resolvedBy?: string;
    resolvedAt?: Date;
  };

  @Column({ type: 'jsonb', nullable: true })
  mitigation: {
    automaticActions?: Array<{
      action: string;
      performedAt: Date;
      result: string;
    }>;
    recommendedActions?: string[];
    blockedResources?: string[];
  };

  @Column({ type: 'boolean', default: false })
  isFalsePositive: boolean;

  @Column({ type: 'text', nullable: true })
  falsePositiveReason: string;

  @CreateDateColumn()
  @Index()
  detectedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  resolvedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date;
}

export interface SecurityEvent {
  userId?: string;
  eventType: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  details?: any;
}

export interface AnomalyRule {
  type: AnomalyType;
  threshold: number;
  timeWindow: number; // minutes
  threatLevel: ThreatLevel;
  enabled: boolean;
  description: string;
}

@Injectable()
export class IntrusionDetectionService {
  private readonly logger = new Logger(IntrusionDetectionService.name);
  private readonly eventBuffer = new Map<string, SecurityEvent[]>();
  private readonly userBaselines = new Map<string, any>();
  private readonly anomalyRules: Map<AnomalyType, AnomalyRule> = new Map();

  constructor(
    @InjectRepository(SecurityAnomaly)
    private readonly anomalyRepository: Repository<SecurityAnomaly>,
    private readonly auditService: SecurityAuditService,
    private readonly configService: ConfigService,
  ) {
    this.initializeRules();
    this.startPeriodicAnalysis();
  }

  private initializeRules(): void {
    // Initialize default anomaly detection rules
    this.anomalyRules.set(AnomalyType.UNUSUAL_LOGIN_TIME, {
      type: AnomalyType.UNUSUAL_LOGIN_TIME,
      threshold: 3, // hours from usual login time
      timeWindow: 1440, // 24 hours
      threatLevel: ThreatLevel.MEDIUM,
      enabled: true,
      description: 'Login outside of usual time patterns',
    });

    this.anomalyRules.set(AnomalyType.UNUSUAL_LOCATION, {
      type: AnomalyType.UNUSUAL_LOCATION,
      threshold: 1000, // kilometers from usual location
      timeWindow: 1440, // 24 hours
      threatLevel: ThreatLevel.HIGH,
      enabled: true,
      description: 'Login from unusual geographic location',
    });

    this.anomalyRules.set(AnomalyType.RAPID_SUCCESSIVE_ATTEMPTS, {
      type: AnomalyType.RAPID_SUCCESSIVE_ATTEMPTS,
      threshold: 10, // attempts
      timeWindow: 5, // minutes
      threatLevel: ThreatLevel.HIGH,
      enabled: true,
      description: 'Rapid successive authentication attempts',
    });

    this.anomalyRules.set(AnomalyType.BRUTE_FORCE_ATTEMPT, {
      type: AnomalyType.BRUTE_FORCE_ATTEMPT,
      threshold: 20, // failed attempts
      timeWindow: 15, // minutes
      threatLevel: ThreatLevel.CRITICAL,
      enabled: true,
      description: 'Potential brute force attack',
    });

    this.anomalyRules.set(AnomalyType.PRIVILEGE_ESCALATION, {
      type: AnomalyType.PRIVILEGE_ESCALATION,
      threshold: 1, // any privilege escalation
      timeWindow: 1, // minute
      threatLevel: ThreatLevel.CRITICAL,
      enabled: true,
      description: 'Privilege escalation detected',
    });

    this.anomalyRules.set(AnomalyType.DATA_EXFILTRATION, {
      type: AnomalyType.DATA_EXFILTRATION,
      threshold: 1000, // records
      timeWindow: 60, // minutes
      threatLevel: ThreatLevel.CRITICAL,
      enabled: true,
      description: 'Potential data exfiltration detected',
    });

    this.anomalyRules.set(AnomalyType.SUSPICIOUS_API_USAGE, {
      type: AnomalyType.SUSPICIOUS_API_USAGE,
      threshold: 1000, // API calls
      timeWindow: 60, // minutes
      threatLevel: ThreatLevel.MEDIUM,
      enabled: true,
      description: 'Unusual API usage patterns',
    });
  }

  async processSecurityEvent(event: SecurityEvent): Promise<void> {
    // Add event to buffer for analysis
    this.addToEventBuffer(event);

    // Update user baseline
    await this.updateUserBaseline(event);

    // Check for anomalies
    await this.checkForAnomalies(event);

    // Clean old events from buffer
    this.cleanEventBuffer();
  }

  async detectAnomaliesForUser(userId: string): Promise<SecurityAnomaly[]> {
    const userEvents = this.getUserEvents(userId);
    const anomalies: SecurityAnomaly[] = [];

    for (const [anomalyType, rule] of this.anomalyRules.entries()) {
      if (!rule.enabled) continue;

      const anomaly = await this.checkSpecificAnomaly(userId, anomalyType, rule, userEvents);
      if (anomaly) {
        anomalies.push(anomaly);
      }
    }

    return anomalies;
  }

  async getActiveAnomalies(
    threatLevel?: ThreatLevel,
    status?: AlertStatus
  ): Promise<SecurityAnomaly[]> {
    const where: any = { status: status || AlertStatus.NEW };
    if (threatLevel) where.threatLevel = threatLevel;

    return this.anomalyRepository.find({
      where,
      relations: ['user'],
      order: { detectedAt: 'DESC' },
    });
  }

  async investigateAnomaly(
    anomalyId: string,
    investigatorId: string,
    notes?: string
  ): Promise<SecurityAnomaly> {
    const anomaly = await this.anomalyRepository.findOne({
      where: { id: anomalyId },
    });

    if (!anomaly) {
      throw new Error('Anomaly not found');
    }

    anomaly.status = AlertStatus.INVESTIGATING;
    anomaly.investigation = {
      assignedTo: investigatorId,
      assignedAt: new Date(),
      notes,
    };

    const savedAnomaly = await this.anomalyRepository.save(anomaly);

    // Log investigation
    await this.auditService.logEvent({
      userId: investigatorId,
      action: AuditEventType.INCIDENT_REPORTED,
      resource: 'security_anomaly',
      resourceId: anomalyId,
      details: {
        anomalyType: anomaly.anomalyType,
        threatLevel: anomaly.threatLevel,
        action: 'investigation_started',
      },
      severity: this.mapThreatLevelToSeverity(anomaly.threatLevel),
    });

    return savedAnomaly;
  }

  async resolveAnomaly(
    anomalyId: string,
    resolverId: string,
    resolution: 'resolved' | 'false_positive',
    notes?: string
  ): Promise<SecurityAnomaly> {
    const anomaly = await this.anomalyRepository.findOne({
      where: { id: anomalyId },
    });

    if (!anomaly) {
      throw new Error('Anomaly not found');
    }

    anomaly.status = resolution === 'false_positive' ? AlertStatus.FALSE_POSITIVE : AlertStatus.RESOLVED;
    anomaly.resolvedAt = new Date();
    anomaly.isFalsePositive = resolution === 'false_positive';
    anomaly.falsePositiveReason = resolution === 'false_positive' ? notes : null;

    anomaly.investigation = {
      ...anomaly.investigation,
      resolution,
      resolvedBy: resolverId,
      resolvedAt: new Date(),
      notes: notes ? (anomaly.investigation?.notes ? `${anomaly.investigation.notes}\n\n${notes}` : notes) : anomaly.investigation?.notes,
    };

    const savedAnomaly = await this.anomalyRepository.save(anomaly);

    // Log resolution
    await this.auditService.logEvent({
      userId: resolverId,
      action: AuditEventType.INCIDENT_REPORTED,
      resource: 'security_anomaly',
      resourceId: anomalyId,
      details: {
        anomalyType: anomaly.anomalyType,
        threatLevel: anomaly.threatLevel,
        action: 'anomaly_resolved',
        resolution,
      },
      severity: this.mapThreatLevelToSeverity(anomaly.threatLevel),
    });

    return savedAnomaly;
  }

  async getSecurityMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalAnomalies: number;
    anomaliesByType: Record<AnomalyType, number>;
    anomaliesByThreatLevel: Record<ThreatLevel, number>;
    falsePositiveRate: number;
    averageResolutionTime: number;
    activeAnomalies: number;
  }> {
    const anomalies = await this.anomalyRepository.find({
      where: {
        detectedAt: Between(startDate, endDate),
      },
    });

    const anomaliesByType = {} as Record<AnomalyType, number>;
    const anomaliesByThreatLevel = {} as Record<ThreatLevel, number>;
    let totalResolutionTime = 0;
    let resolvedCount = 0;
    let falsePositiveCount = 0;

    for (const anomaly of anomalies) {
      // Count by type
      anomaliesByType[anomaly.anomalyType] = (anomaliesByType[anomaly.anomalyType] || 0) + 1;
      
      // Count by threat level
      anomaliesByThreatLevel[anomaly.threatLevel] = (anomaliesByThreatLevel[anomaly.threatLevel] || 0) + 1;
      
      // Calculate resolution time
      if (anomaly.resolvedAt) {
        totalResolutionTime += anomaly.resolvedAt.getTime() - anomaly.detectedAt.getTime();
        resolvedCount++;
      }
      
      // Count false positives
      if (anomaly.isFalsePositive) {
        falsePositiveCount++;
      }
    }

    const activeAnomalies = await this.anomalyRepository.count({
      where: {
        status: In([AlertStatus.NEW, AlertStatus.INVESTIGATING]),
      },
    });

    return {
      totalAnomalies: anomalies.length,
      anomaliesByType,
      anomaliesByThreatLevel,
      falsePositiveRate: anomalies.length > 0 ? (falsePositiveCount / anomalies.length) * 100 : 0,
      averageResolutionTime: resolvedCount > 0 ? totalResolutionTime / resolvedCount / (1000 * 60) : 0, // minutes
      activeAnomalies,
    };
  }

  private addToEventBuffer(event: SecurityEvent): void {
    const bufferKey = event.userId || 'anonymous';
    
    if (!this.eventBuffer.has(bufferKey)) {
      this.eventBuffer.set(bufferKey, []);
    }
    
    const buffer = this.eventBuffer.get(bufferKey)!;
    buffer.push(event);
    
    // Keep only last 1000 events per user
    if (buffer.length > 1000) {
      buffer.splice(0, buffer.length - 1000);
    }
  }

  private getUserEvents(userId: string): SecurityEvent[] {
    return this.eventBuffer.get(userId) || [];
  }

  private cleanEventBuffer(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [userId, events] of this.eventBuffer.entries()) {
      const filteredEvents = events.filter(event => event.timestamp > cutoffTime);
      this.eventBuffer.set(userId, filteredEvents);
    }
  }

  private async updateUserBaseline(event: SecurityEvent): Promise<void> {
    if (!event.userId) return;

    const baseline = this.userBaselines.get(event.userId) || {
      loginTimes: [],
      locations: [],
      apiUsage: [],
      lastUpdated: new Date(),
    };

    // Update baseline with new event data
    if (event.eventType === 'login') {
      baseline.loginTimes.push(event.timestamp.getHours());
      
      if (event.details?.geolocation) {
        baseline.locations.push(event.details.geolocation);
      }
    }

    if (event.eventType.startsWith('api_')) {
      baseline.apiUsage.push(event.timestamp);
    }

    // Keep only recent data for baseline (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    baseline.loginTimes = baseline.loginTimes.filter(() => Math.random() > 0.1); // Simplified
    baseline.locations = baseline.locations.slice(-100);
    baseline.apiUsage = baseline.apiUsage.filter(time => time > thirtyDaysAgo);

    baseline.lastUpdated = new Date();
    this.userBaselines.set(event.userId, baseline);
  }

  private async checkForAnomalies(event: SecurityEvent): Promise<void> {
    if (!event.userId) return;

    const anomalies = await this.detectAnomaliesForUser(event.userId);
    
    for (const anomaly of anomalies) {
      await this.saveAnomaly(anomaly);
      await this.triggerAutomatedResponse(anomaly);
    }
  }

  private async checkSpecificAnomaly(
    userId: string,
    anomalyType: AnomalyType,
    rule: AnomalyRule,
    userEvents: SecurityEvent[]
  ): Promise<SecurityAnomaly | null> {
    const cutoffTime = new Date(Date.now() - rule.timeWindow * 60 * 1000);
    const recentEvents = userEvents.filter(event => event.timestamp > cutoffTime);

    switch (anomalyType) {
      case AnomalyType.UNUSUAL_LOGIN_TIME:
        return this.checkUnusualLoginTime(userId, rule, recentEvents);
      
      case AnomalyType.UNUSUAL_LOCATION:
        return this.checkUnusualLocation(userId, rule, recentEvents);
      
      case AnomalyType.RAPID_SUCCESSIVE_ATTEMPTS:
        return this.checkRapidSuccessiveAttempts(userId, rule, recentEvents);
      
      case AnomalyType.BRUTE_FORCE_ATTEMPT:
        return this.checkBruteForceAttempt(userId, rule, recentEvents);
      
      case AnomalyType.PRIVILEGE_ESCALATION:
        return this.checkPrivilegeEscalation(userId, rule, recentEvents);
      
      case AnomalyType.DATA_EXFILTRATION:
        return this.checkDataExfiltration(userId, rule, recentEvents);
      
      case AnomalyType.SUSPICIOUS_API_USAGE:
        return this.checkSuspiciousApiUsage(userId, rule, recentEvents);
      
      default:
        return null;
    }
  }

  private async checkUnusualLoginTime(
    userId: string,
    rule: AnomalyRule,
    events: SecurityEvent[]
  ): Promise<SecurityAnomaly | null> {
    const loginEvents = events.filter(e => e.eventType === 'login_success');
    if (loginEvents.length === 0) return null;

    const baseline = this.userBaselines.get(userId);
    if (!baseline || baseline.loginTimes.length === 0) return null;

    const currentHour = loginEvents[loginEvents.length - 1].timestamp.getHours();
    const avgHour = baseline.loginTimes.reduce((sum, hour) => sum + hour, 0) / baseline.loginTimes.length;
    
    const hourDiff = Math.abs(currentHour - avgHour);
    if (hourDiff > rule.threshold) {
      return this.createAnomaly(userId, AnomalyType.UNUSUAL_LOGIN_TIME, rule, {
        currentHour,
        averageHour: avgHour,
        hourDifference: hourDiff,
      }, loginEvents[loginEvents.length - 1]);
    }

    return null;
  }

  private async checkUnusualLocation(
    userId: string,
    rule: AnomalyRule,
    events: SecurityEvent[]
  ): Promise<SecurityAnomaly | null> {
    const loginEvents = events.filter(e => e.eventType === 'login_success' && e.details?.geolocation);
    if (loginEvents.length === 0) return null;

    const baseline = this.userBaselines.get(userId);
    if (!baseline || baseline.locations.length === 0) return null;

    const currentLocation = loginEvents[loginEvents.length - 1].details.geolocation;
    const distance = this.calculateDistance(currentLocation, baseline.locations[0]); // Simplified
    
    if (distance > rule.threshold) {
      return this.createAnomaly(userId, AnomalyType.UNUSUAL_LOCATION, rule, {
        currentLocation,
        distance,
        baselineLocation: baseline.locations[0],
      }, loginEvents[loginEvents.length - 1]);
    }

    return null;
  }

  private async checkRapidSuccessiveAttempts(
    userId: string,
    rule: AnomalyRule,
    events: SecurityEvent[]
  ): Promise<SecurityAnomaly | null> {
    const attempts = events.filter(e => e.eventType.includes('login'));
    
    if (attempts.length >= rule.threshold) {
      return this.createAnomaly(userId, AnomalyType.RAPID_SUCCESSIVE_ATTEMPTS, rule, {
        attemptCount: attempts.length,
        timeWindow: rule.timeWindow,
      }, attempts[attempts.length - 1]);
    }

    return null;
  }

  private async checkBruteForceAttempt(
    userId: string,
    rule: AnomalyRule,
    events: SecurityEvent[]
  ): Promise<SecurityAnomaly | null> {
    const failedAttempts = events.filter(e => e.eventType === 'login_failed');
    
    if (failedAttempts.length >= rule.threshold) {
      return this.createAnomaly(userId, AnomalyType.BRUTE_FORCE_ATTEMPT, rule, {
        failedAttemptCount: failedAttempts.length,
        timeWindow: rule.timeWindow,
      }, failedAttempts[failedAttempts.length - 1]);
    }

    return null;
  }

  private async checkPrivilegeEscalation(
    userId: string,
    rule: AnomalyRule,
    events: SecurityEvent[]
  ): Promise<SecurityAnomaly | null> {
    const escalationEvents = events.filter(e => e.eventType === 'privilege_escalation');
    
    if (escalationEvents.length > 0) {
      return this.createAnomaly(userId, AnomalyType.PRIVILEGE_ESCALATION, rule, {
        escalationCount: escalationEvents.length,
        details: escalationEvents[0].details,
      }, escalationEvents[0]);
    }

    return null;
  }

  private async checkDataExfiltration(
    userId: string,
    rule: AnomalyRule,
    events: SecurityEvent[]
  ): Promise<SecurityAnomaly | null> {
    const exportEvents = events.filter(e => e.eventType === 'data_export');
    const totalRecords = exportEvents.reduce((sum, e) => sum + (e.details?.recordCount || 0), 0);
    
    if (totalRecords >= rule.threshold) {
      return this.createAnomaly(userId, AnomalyType.DATA_EXFILTRATION, rule, {
        recordCount: totalRecords,
        exportCount: exportEvents.length,
        timeWindow: rule.timeWindow,
      }, exportEvents[exportEvents.length - 1]);
    }

    return null;
  }

  private async checkSuspiciousApiUsage(
    userId: string,
    rule: AnomalyRule,
    events: SecurityEvent[]
  ): Promise<SecurityAnomaly | null> {
    const apiEvents = events.filter(e => e.eventType.startsWith('api_'));
    
    if (apiEvents.length >= rule.threshold) {
      return this.createAnomaly(userId, AnomalyType.SUSPICIOUS_API_USAGE, rule, {
        apiCallCount: apiEvents.length,
        timeWindow: rule.timeWindow,
        endpoints: [...new Set(apiEvents.map(e => e.details?.endpoint))],
      }, apiEvents[apiEvents.length - 1]);
    }

    return null;
  }

  private createAnomaly(
    userId: string,
    type: AnomalyType,
    rule: AnomalyRule,
    anomalyData: any,
    triggeringEvent: SecurityEvent
  ): SecurityAnomaly {
    return this.anomalyRepository.create({
      userId,
      anomalyType: type,
      threatLevel: rule.threatLevel,
      description: rule.description,
      anomalyData: {
        triggeredBy: triggeringEvent.eventType,
        threshold: rule.threshold,
        actualValue: this.extractActualValue(anomalyData),
        timeWindow: `${rule.timeWindow} minutes`,
        baseline: this.calculateBaseline(userId, type),
        confidence: this.calculateConfidence(anomalyData),
        patterns: this.identifyPatterns(anomalyData),
      },
      context: {
        ipAddress: triggeringEvent.ipAddress,
        userAgent: triggeringEvent.userAgent,
        sessionId: triggeringEvent.sessionId,
        geolocation: triggeringEvent.details?.geolocation,
        previousActivity: this.getRecentActivity(userId, 10),
      },
      status: AlertStatus.NEW,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });
  }

  private async saveAnomaly(anomaly: SecurityAnomaly): Promise<void> {
    try {
      await this.anomalyRepository.save(anomaly);
      
      // Log anomaly detection
      await this.auditService.logEvent({
        userId: anomaly.userId,
        action: AuditEventType.INCIDENT_REPORTED,
        resource: 'security_anomaly',
        resourceId: anomaly.id,
        details: {
          anomalyType: anomaly.anomalyType,
          threatLevel: anomaly.threatLevel,
          description: anomaly.description,
        },
        severity: this.mapThreatLevelToSeverity(anomaly.threatLevel),
      });
    } catch (error) {
      this.logger.error('Failed to save anomaly:', error);
    }
  }

  private async triggerAutomatedResponse(anomaly: SecurityAnomaly): Promise<void> {
    const responses = [];

    switch (anomaly.threatLevel) {
      case ThreatLevel.CRITICAL:
        responses.push(...await this.handleCriticalThreat(anomaly));
        break;
      case ThreatLevel.HIGH:
        responses.push(...await this.handleHighThreat(anomaly));
        break;
      case ThreatLevel.MEDIUM:
        responses.push(...await this.handleMediumThreat(anomaly));
        break;
    }

    // Update anomaly with mitigation actions
    anomaly.mitigation = {
      automaticActions: responses,
      recommendedActions: this.getRecommendedActions(anomaly),
    };

    await this.anomalyRepository.save(anomaly);
  }

  private async handleCriticalThreat(anomaly: SecurityAnomaly): Promise<any[]> {
    const actions = [];

    if (anomaly.userId) {
      // Temporarily lock user account
      actions.push({
        action: 'account_locked',
        performedAt: new Date(),
        result: 'success',
      });

      // Invalidate all sessions
      actions.push({
        action: 'sessions_invalidated',
        performedAt: new Date(),
        result: 'success',
      });
    }

    // Block IP address
    if (anomaly.context?.ipAddress) {
      actions.push({
        action: 'ip_blocked',
        performedAt: new Date(),
        result: 'success',
      });
    }

    return actions;
  }

  private async handleHighThreat(anomaly: SecurityAnomaly): Promise<any[]> {
    const actions = [];

    // Require additional authentication
    if (anomaly.userId) {
      actions.push({
        action: 'mfa_required',
        performedAt: new Date(),
        result: 'success',
      });
    }

    // Rate limiting
    actions.push({
      action: 'rate_limit_increased',
      performedAt: new Date(),
      result: 'success',
    });

    return actions;
  }

  private async handleMediumThreat(anomaly: SecurityAnomaly): Promise<any[]> {
    const actions = [];

    // Send security notification
    actions.push({
      action: 'security_notification_sent',
      performedAt: new Date(),
      result: 'success',
    });

    // Enhanced monitoring
    actions.push({
      action: 'enhanced_monitoring_enabled',
      performedAt: new Date(),
      result: 'success',
    });

    return actions;
  }

  private getRecommendedActions(anomaly: SecurityAnomaly): string[] {
    const actions = [];

    switch (anomaly.anomalyType) {
      case AnomalyType.UNUSUAL_LOGIN_TIME:
        actions.push('Verify user identity through additional authentication');
        actions.push('Contact user to confirm recent login activity');
        break;
      
      case AnomalyType.UNUSUAL_LOCATION:
        actions.push('Verify user location and travel plans');
        actions.push('Consider temporary travel notification system');
        break;
      
      case AnomalyType.BRUTE_FORCE_ATTEMPT:
        actions.push('Block attacking IP addresses');
        actions.push('Implement account lockout policies');
        actions.push('Consider CAPTCHA implementation');
        break;
      
      case AnomalyType.PRIVILEGE_ESCALATION:
        actions.push('Review privilege escalation request');
        actions.push('Verify legitimate business need');
        actions.push('Document approval process');
        break;
      
      case AnomalyType.DATA_EXFILTRATION:
        actions.push('Immediate investigation of data access patterns');
        actions.push('Review data export permissions');
        actions.push('Consider temporary data access restrictions');
        break;
    }

    return actions;
  }

  private calculateDistance(loc1: any, loc2: any): number {
    // Simplified distance calculation
    if (!loc1?.coordinates || !loc2?.coordinates) return 0;
    
    const [lat1, lon1] = loc1.coordinates;
    const [lat2, lon2] = loc2.coordinates;
    
    // Haversine formula (simplified)
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
  }

  private extractActualValue(anomalyData: any): number {
    if (anomalyData.hourDifference) return anomalyData.hourDifference;
    if (anomalyData.distance) return anomalyData.distance;
    if (anomalyData.attemptCount) return anomalyData.attemptCount;
    if (anomalyData.failedAttemptCount) return anomalyData.failedAttemptCount;
    if (anomalyData.recordCount) return anomalyData.recordCount;
    if (anomalyData.apiCallCount) return anomalyData.apiCallCount;
    return 0;
  }

  private calculateBaseline(userId: string, type: AnomalyType): number {
    const baseline = this.userBaselines.get(userId);
    if (!baseline) return 0;

    switch (type) {
      case AnomalyType.UNUSUAL_LOGIN_TIME:
        return baseline.loginTimes.length > 0 
          ? baseline.loginTimes.reduce((sum, hour) => sum + hour, 0) / baseline.loginTimes.length 
          : 12; // Default to noon
      
      case AnomalyType.SUSPICIOUS_API_USAGE:
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentApiCalls = baseline.apiUsage.filter(time => time > thirtyDaysAgo);
        return recentApiCalls.length / 30; // Daily average
      
      default:
        return 0;
    }
  }

  private calculateConfidence(anomalyData: any): number {
    // Simplified confidence calculation
    let confidence = 0.5; // Base confidence

    if (anomalyData.hourDifference > 6) confidence += 0.3;
    if (anomalyData.distance > 2000) confidence += 0.3;
    if (anomalyData.attemptCount > 20) confidence += 0.4;
    if (anomalyData.failedAttemptCount > 50) confidence += 0.4;

    return Math.min(1.0, confidence);
  }

  private identifyPatterns(anomalyData: any): Array<{ type: string; description: string; weight: number }> {
    const patterns = [];

    if (anomalyData.hourDifference && anomalyData.hourDifference > 8) {
      patterns.push({
        type: 'off_hours_activity',
        description: 'Activity occurring outside normal business hours',
        weight: 0.3,
      });
    }

    if (anomalyData.distance && anomalyData.distance > 1000) {
      patterns.push({
        type: 'geographic_anomaly',
        description: 'Login from distant geographic location',
        weight: 0.4,
      });
    }

    if (anomalyData.attemptCount && anomalyData.attemptCount > 10) {
      patterns.push({
        type: 'high_frequency_attempts',
        description: 'High frequency of authentication attempts',
        weight: 0.5,
      });
    }

    return patterns;
  }

  private getRecentActivity(userId: string, limit: number): Array<{ timestamp: Date; action: string; details: any }> {
    const events = this.getUserEvents(userId);
    return events
      .slice(-limit)
      .map(event => ({
        timestamp: event.timestamp,
        action: event.eventType,
        details: event.details,
      }));
  }

  private mapThreatLevelToSeverity(threatLevel: ThreatLevel): any {
    const severityMap = {
      [ThreatLevel.LOW]: 'LOW',
      [ThreatLevel.MEDIUM]: 'MEDIUM',
      [ThreatLevel.HIGH]: 'HIGH',
      [ThreatLevel.CRITICAL]: 'CRITICAL',
    };

    return severityMap[threatLevel] || 'LOW';
  }

  private startPeriodicAnalysis(): void {
    // Run analysis every 5 minutes
    setInterval(async () => {
      try {
        await this.performPeriodicAnalysis();
      } catch (error) {
        this.logger.error('Periodic analysis failed:', error);
      }
    }, 5 * 60 * 1000);
  }

  private async performPeriodicAnalysis(): Promise<void> {
    // Clean old anomalies
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await this.anomalyRepository.delete({
      detectedAt: LessThan(thirtyDaysAgo),
      status: AlertStatus.RESOLVED,
    });

    // Update baselines
    for (const [userId, events] of this.eventBuffer.entries()) {
      if (events.length > 0) {
        await this.updateUserBaseline(events[events.length - 1]);
      }
    }
  }
}
