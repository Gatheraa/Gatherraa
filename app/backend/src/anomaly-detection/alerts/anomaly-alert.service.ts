/**
 * Anomaly Alert Management Service
 * Handles alert creation, tracking, and operator actions
 */

import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  AnomalyAlert,
  DetectionResult,
  AnomalyAction,
  AnomalyExplanation,
  ExplanationIndicator,
} from '../types/order-book.types';

export interface AlertStore {
  alerts: Map<string, AnomalyAlert>;
  acknowledgedAlerts: Set<string>;
  resolvedAlerts: Set<string>;
  throttledActors: Map<string, { until: number; reason: string }>;
}

@Injectable()
export class AnomalyAlertService {
  private readonly logger = new Logger(AnomalyAlertService.name);
  private alertStore: AlertStore = {
    alerts: new Map(),
    acknowledgedAlerts: new Set(),
    resolvedAlerts: new Set(),
    throttledActors: new Map(),
  };

  /**
   * Create an alert from a detection result
   */
  createAlert(detection: DetectionResult): AnomalyAlert {
    const alertId = uuidv4();

    const alert: AnomalyAlert = {
      alertId,
      detectionId: detection.patternId,
      timestamp: detection.timestamp,
      symbol: detection.symbol,
      patternName: detection.patternName,
      severity: detection.severity,
      confidence: detection.confidence,
      traderId: detection.traderId,
      status: 'OPEN',
      actions: [],
      explainability: this.generateExplanation(detection),
    };

    this.alertStore.alerts.set(alertId, alert);
    this.logger.warn(
      `Created alert ${alertId} for ${detection.patternName} (${detection.severity})`,
    );

    return alert;
  }

  /**
   * Get an alert by ID
   */
  getAlert(alertId: string): AnomalyAlert | null {
    return this.alertStore.alerts.get(alertId) || null;
  }

  /**
   * Get all open alerts
   */
  getOpenAlerts(symbol?: string): AnomalyAlert[] {
    const alerts = Array.from(this.alertStore.alerts.values());
    return alerts.filter(
      (a) =>
        a.status === 'OPEN' &&
        (!symbol || a.symbol === symbol),
    );
  }

  /**
   * Get alerts for a specific trader
   */
  getAlertsForTrader(traderId: string): AnomalyAlert[] {
    const alerts = Array.from(this.alertStore.alerts.values());
    return alerts.filter((a) => a.traderId === traderId);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy?: string): boolean {
    const alert = this.alertStore.alerts.get(alertId);
    if (!alert) return false;

    alert.status = 'ACKNOWLEDGED';
    this.alertStore.acknowledgedAlerts.add(alertId);
    this.logger.info(`Alert ${alertId} acknowledged by ${acknowledgedBy || 'system'}`);
    return true;
  }

  /**
   * Update alert status to investigating
   */
  setAlertInvestigating(alertId: string): boolean {
    const alert = this.alertStore.alerts.get(alertId);
    if (!alert) return false;

    alert.status = 'INVESTIGATING';
    return true;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string, resolution: 'RESOLVED' | 'FALSE_POSITIVE'): boolean {
    const alert = this.alertStore.alerts.get(alertId);
    if (!alert) return false;

    alert.status = resolution;
    this.alertStore.resolvedAlerts.add(alertId);
    this.logger.info(`Alert ${alertId} resolved as ${resolution}`);
    return true;
  }

  /**
   * Execute an action on an alert (throttle, block, etc.)
   */
  executeAction(
    alertId: string,
    actionType: 'THROTTLE' | 'BLOCK' | 'AUTO_BAN' | 'REVIEW' | 'ESCALATE',
    parameters?: Record<string, any>,
  ): AnomalyAction | null {
    const alert = this.alertStore.alerts.get(alertId);
    if (!alert || !alert.traderId) return null;

    const action: AnomalyAction = {
      type: actionType,
      status: 'PENDING',
      timestamp: Date.now(),
      parameters,
    };

    try {
      switch (actionType) {
        case 'THROTTLE':
          this.throttleActor(alert.traderId, parameters?.durationMs || 3600000);
          action.result = `Throttled ${alert.traderId} for ${parameters?.durationMs || 3600000}ms`;
          action.status = 'EXECUTED';
          break;

        case 'BLOCK':
          this.blockActor(alert.traderId, parameters?.duration || '1h');
          action.result = `Blocked ${alert.traderId}`;
          action.status = 'EXECUTED';
          break;

        case 'AUTO_BAN':
          this.autobanActor(alert.traderId);
          action.result = `Auto-banned ${alert.traderId}`;
          action.status = 'EXECUTED';
          break;

        case 'REVIEW':
          this.escalateToReview(alert);
          action.result = `Escalated to review team`;
          action.status = 'EXECUTED';
          break;

        case 'ESCALATE':
          this.escalateAlert(alert);
          action.result = `Escalated to higher authority`;
          action.status = 'EXECUTED';
          break;
      }

      alert.actions.push(action);
      this.logger.info(
        `Executed action ${actionType} on alert ${alertId}: ${action.result}`,
      );
      return action;
    } catch (error) {
      action.status = 'FAILED';
      action.result = `Action failed: ${error}`;
      alert.actions.push(action);
      this.logger.error(`Failed to execute action ${actionType}: ${error}`);
      return action;
    }
  }

  /**
   * Throttle a suspicious actor
   */
  private throttleActor(traderId: string, durationMs: number): void {
    const until = Date.now() + durationMs;
    this.alertStore.throttledActors.set(traderId, {
      until,
      reason: 'Anomaly detection throttle',
    });
    this.logger.warn(`Throttled actor ${traderId} until ${new Date(until).toISOString()}`);
  }

  /**
   * Block an actor
   */
  private blockActor(traderId: string, duration: string): void {
    const durationMs = this.parseDuration(duration);
    const until = Date.now() + durationMs;
    this.alertStore.throttledActors.set(traderId, {
      until,
      reason: `Blocked for ${duration}`,
    });
    this.logger.warn(`Blocked actor ${traderId} until ${new Date(until).toISOString()}`);
  }

  /**
   * Auto-ban an actor permanently
   */
  private autobanActor(traderId: string): void {
    this.alertStore.throttledActors.set(traderId, {
      until: Date.now() + 100 * 365 * 24 * 60 * 60 * 1000, // ~100 years
      reason: 'Auto-banned due to anomaly detection',
    });
    this.logger.error(`Auto-banned actor ${traderId}`);
  }

  /**
   * Escalate alert to review team
   */
  private escalateToReview(alert: AnomalyAlert): void {
    // In production, this would send to a review queue
    this.logger.warn(`Alert ${alert.alertId} escalated to review team`);
  }

  /**
   * Escalate alert to higher authority
   */
  private escalateAlert(alert: AnomalyAlert): void {
    // In production, this would send to compliance/legal
    this.logger.warn(`Alert ${alert.alertId} escalated to higher authority`);
  }

  /**
   * Check if an actor is throttled
   */
  isActorThrottled(traderId: string): boolean {
    const throttle = this.alertStore.throttledActors.get(traderId);
    if (!throttle) return false;

    if (Date.now() > throttle.until) {
      this.alertStore.throttledActors.delete(traderId);
      return false;
    }

    return true;
  }

  /**
   * Get throttle info for an actor
   */
  getThrottleInfo(traderId: string): { until: number; reason: string } | null {
    return this.alertStore.throttledActors.get(traderId) || null;
  }

  /**
   * Generate explainability information for an alert
   */
  private generateExplanation(detection: DetectionResult): AnomalyExplanation {
    const indicators: ExplanationIndicator[] = detection.evidence.map((e) => ({
      name: e.type,
      value: e.value,
      threshold: e.threshold,
      impact: e.value > e.threshold ? 'HIGH' : 'MEDIUM',
      description: e.description,
    }));

    return {
      summary: detection.explainability,
      indicators,
      relatedPatterns: this.findRelatedPatterns(detection.patternId),
      confidence: detection.confidence,
      historicalContext: this.generateHistoricalContext(
        detection.symbol,
        detection.traderId,
      ),
    };
  }

  /**
   * Find related patterns
   */
  private findRelatedPatterns(patternId: string): string[] {
    const related: Record<string, string[]> = {
      SPOOFING_LARGE_ORDERS: [
        'SPOOFING_RAPID_CANCEL',
        'MARKET_MANIPULATION_SPOOFING_SCALP',
      ],
      LAYERING_BID_SIDE: ['LAYERING_ASK_SIDE', 'MARKET_MANIPULATION_LAYERING_SCALP'],
      WASH_TRADING_SELF_DEALING: ['WASH_TRADING_VOLUME_PUMP'],
      PUMP_DUMP_COORDINATED: ['PUMP_DUMP_MOMENTUM', 'UNUSUAL_VOLUME_SPIKE'],
    };

    return related[patternId] || [];
  }

  /**
   * Generate historical context
   */
  private generateHistoricalContext(symbol: string, traderId?: string): string {
    // In production, this would query historical data
    if (traderId) {
      return `Trader ${traderId} has ${Math.floor(Math.random() * 5)} previous anomaly alerts in the last 30 days.`;
    }
    return `Symbol ${symbol} has had ${Math.floor(Math.random() * 10)} anomaly detections in the last 7 days.`;
  }

  /**
   * Parse duration string (e.g., "1h", "30m", "7d")
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([hmd])$/);
    if (!match) return 3600000; // Default 1 hour

    const [, value, unit] = match;
    const multipliers: Record<string, number> = {
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return parseInt(value, 10) * (multipliers[unit] || 3600000);
  }

  /**
   * Get alert statistics
   */
  getAlertStatistics(periodDays: number = 7) {
    const cutoffTime = Date.now() - periodDays * 24 * 60 * 60 * 1000;
    const alerts = Array.from(this.alertStore.alerts.values()).filter(
      (a) => a.timestamp > cutoffTime,
    );

    const bySeverity: Record<string, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };

    const byStatus: Record<string, number> = {
      OPEN: 0,
      ACKNOWLEDGED: 0,
      INVESTIGATING: 0,
      RESOLVED: 0,
      FALSE_POSITIVE: 0,
    };

    const byPattern: Record<string, number> = {};

    for (const alert of alerts) {
      bySeverity[alert.severity]++;
      byStatus[alert.status]++;
      byPattern[alert.patternName] = (byPattern[alert.patternName] || 0) + 1;
    }

    return {
      totalAlerts: alerts.length,
      bySeverity,
      byStatus,
      byPattern,
      averageConfidence:
        alerts.length > 0
          ? alerts.reduce((sum, a) => sum + a.confidence, 0) / alerts.length
          : 0,
      uniqueTraders: new Set(alerts.map((a) => a.traderId)).size,
    };
  }

  /**
   * Export alerts for audit trail
   */
  exportAlerts(format: 'json' | 'csv' = 'json'): string {
    const alerts = Array.from(this.alertStore.alerts.values());

    if (format === 'csv') {
      const header = [
        'alertId',
        'timestamp',
        'symbol',
        'patternName',
        'severity',
        'confidence',
        'traderId',
        'status',
      ].join(',');

      const rows = alerts.map((a) =>
        [
          a.alertId,
          new Date(a.timestamp).toISOString(),
          a.symbol,
          a.patternName,
          a.severity,
          a.confidence.toFixed(3),
          a.traderId || 'N/A',
          a.status,
        ].join(','),
      );

      return [header, ...rows].join('\n');
    } else {
      return JSON.stringify(alerts, null, 2);
    }
  }
}
