/**
 * Anomaly Detection Coordinator Service
 * Orchestrates all detection engines and produces alerts
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  OrderbookSnapshot,
  OrderbookEvent,
  MarketData,
  DetectionResult,
  AnomalyAlert,
  AnomalyConfig,
} from '../types/order-book.types';
import { OrderbookDataIngestionService, FeatureVector } from '../ingestion/orderbook-data-ingestion.service';
import { HeuristicDetectionEngine } from '../engines/heuristic-detection.engine';
import { MLDetectionEngine } from '../engines/ml-detection.engine';
import { AnomalyAlertService } from '../alerts/anomaly-alert.service';

export interface DetectionReport {
  timestamp: number;
  symbol: string;
  detections: DetectionResult[];
  alerts: AnomalyAlert[];
  statistics: {
    totalDetections: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };
}

@Injectable()
export class AnomalyDetectionCoordinatorService {
  private readonly logger = new Logger(AnomalyDetectionCoordinatorService.name);

  private config: AnomalyConfig = {
    enabledPatterns: [
      'SPOOFING_LARGE_ORDERS',
      'SPOOFING_RAPID_CANCEL',
      'LAYERING_BID_SIDE',
      'LAYERING_ASK_SIDE',
      'WASH_TRADING_SELF_DEALING',
      'PUMP_DUMP_COORDINATED',
      'UNUSUAL_VOLUME_SPIKE',
      'UNUSUAL_PRICE_VOLATILITY',
    ],
    alertThreshold: 0.70,
    throttleThreshold: 0.80,
    blockThreshold: 0.90,
    windowSize: 60000, // 60 seconds
    lookbackPeriod: 3600000, // 1 hour
    mlEnabled: true,
    heuristicsEnabled: true,
    explainabilityLevel: 'COMPREHENSIVE',
  };

  private historicalFeatures: Map<string, FeatureVector[]> = new Map();
  private historicalVolumes: Map<string, number[]> = new Map();
  private historicalVolatility: Map<string, number[]> = new Map();

  constructor(
    private ingestionService: OrderbookDataIngestionService,
    private heuristicEngine: HeuristicDetectionEngine,
    private mlEngine: MLDetectionEngine,
    private alertService: AnomalyAlertService,
  ) {
    // Clean expired historical data periodically
    setInterval(() => this.cleanupHistoricalData(), 300000); // Every 5 minutes
  }

  /**
   * Process a new orderbook snapshot
   */
  async processOrderbookSnapshot(snapshot: OrderbookSnapshot): Promise<DetectionReport> {
    const startTime = Date.now();

    try {
      this.ingestionService.ingestOrderbookSnapshot(snapshot);

      const detections: DetectionResult[] = [];

      // Extract features
      const features = this.ingestionService.extractFeatures(snapshot.symbol);

      // Run heuristic detection
      if (this.config.heuristicsEnabled) {
        detections.push(
          ...this.heuristicEngine.detectSpoofing(
            this.ingestionService.getRecentEvents(snapshot.symbol),
            snapshot,
          ),
        );

        detections.push(
          ...this.heuristicEngine.detectLayering(
            this.ingestionService.getRecentEvents(snapshot.symbol),
            snapshot,
          ),
        );

        detections.push(
          ...this.heuristicEngine.detectWashTrading(
            this.ingestionService.getRecentEvents(snapshot.symbol),
          ),
        );

        detections.push(
          ...this.heuristicEngine.detectPumpDump(
            this.ingestionService.getRecentEvents(snapshot.symbol),
            features,
          ),
        );
      }

      // Run ML-based detection
      if (this.config.mlEnabled) {
        const historicalVols = this.historicalVolumes.get(snapshot.symbol) || [];
        detections.push(
          ...this.mlEngine.detectUnusualVolumeSpike(features, historicalVols),
        );

        const historicalVol = this.historicalVolatility.get(snapshot.symbol) || [];
        detections.push(
          ...this.mlEngine.detectUnusualVolatility(features, historicalVol),
        );

        const historicalFeats = this.historicalFeatures.get(snapshot.symbol) || [];
        if (historicalFeats.length >= 10) {
          detections.push(
            ...this.mlEngine.detectMultidimensionalAnomalies(
              features,
              historicalFeats,
            ),
          );
        }
      }

      // Filter detections by config
      const filteredDetections = detections.filter((d) =>
        this.config.enabledPatterns.includes(d.patternId),
      );

      // Generate alerts
      const alerts: AnomalyAlert[] = [];
      for (const detection of filteredDetections) {
        if (detection.confidence >= this.config.alertThreshold) {
          const alert = this.alertService.createAlert(detection);
          alerts.push(alert);

          // Execute auto-actions based on confidence
          if (detection.confidence >= this.config.blockThreshold && alert.traderId) {
            this.alertService.executeAction(alert.alertId, 'AUTO_BAN');
          } else if (
            detection.confidence >= this.config.throttleThreshold &&
            alert.traderId
          ) {
            this.alertService.executeAction(alert.alertId, 'THROTTLE', {
              durationMs: 600000, // 10 minutes
            });
          }
        }
      }

      // Update historical data
      this.updateHistoricalData(snapshot.symbol, features);

      const report: DetectionReport = {
        timestamp: Date.now(),
        symbol: snapshot.symbol,
        detections: filteredDetections,
        alerts,
        statistics: {
          totalDetections: filteredDetections.length,
          criticalCount: filteredDetections.filter((d) => d.severity === 'CRITICAL').length,
          highCount: filteredDetections.filter((d) => d.severity === 'HIGH').length,
          mediumCount: filteredDetections.filter((d) => d.severity === 'MEDIUM').length,
          lowCount: filteredDetections.filter((d) => d.severity === 'LOW').length,
        },
      };

      const processingTime = Date.now() - startTime;
      this.logger.debug(
        `Processed snapshot for ${snapshot.symbol} in ${processingTime}ms. Found ${filteredDetections.length} detections.`,
      );

      return report;
    } catch (error) {
      this.logger.error(
        `Failed to process orderbook snapshot for ${snapshot.symbol}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Process a new orderbook event
   */
  async processOrderbookEvent(event: OrderbookEvent): Promise<void> {
    try {
      this.ingestionService.ingestOrderbookEvent(event);

      // Check if trader is already throttled
      if (this.alertService.isActorThrottled(event.traderId)) {
        this.logger.warn(
          `Ignoring event from throttled trader ${event.traderId}`,
        );
        return;
      }
    } catch (error) {
      this.logger.error(`Failed to process orderbook event: ${error}`);
    }
  }

  /**
   * Process market data
   */
  async processMarketData(marketData: MarketData): Promise<void> {
    try {
      this.ingestionService.ingestMarketData(marketData);
    } catch (error) {
      this.logger.error(`Failed to process market data: ${error}`);
    }
  }

  /**
   * Get anomaly alerts for a symbol
   */
  getSymbolAlerts(symbol: string): AnomalyAlert[] {
    return this.alertService.getOpenAlerts(symbol);
  }

  /**
   * Get anomaly alerts for a trader
   */
  getTraderAlerts(traderId: string): AnomalyAlert[] {
    return this.alertService.getAlertsForTrader(traderId);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AnomalyConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Anomaly detection configuration updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): AnomalyConfig {
    return { ...this.config };
  }

  /**
   * Get alert statistics
   */
  getAlertStatistics(periodDays: number = 7) {
    return this.alertService.getAlertStatistics(periodDays);
  }

  /**
   * Run backtest on historical data
   */
  async runBacktest(
    symbol: string,
    startTime: number,
    endTime: number,
    snapshots: OrderbookSnapshot[],
    events: OrderbookEvent[],
  ): Promise<{
    totalSnapshots: number;
    totalDetections: number;
    detectionsByType: Record<string, number>;
    processingTimeMs: number;
    truePositives?: number;
    falsePositives?: number;
  }> {
    const startTimeBt = Date.now();
    let totalDetections = 0;
    const detectionsByType: Record<string, number> = {};

    try {
      this.logger.info(`Starting backtest for ${symbol} from ${startTime} to ${endTime}`);

      for (const snapshot of snapshots.filter(
        (s) => s.timestamp >= startTime && s.timestamp <= endTime,
      )) {
        // Skip historical data updates during backtest
        const report = await this.processOrderbookSnapshot(snapshot);
        totalDetections += report.detections.length;

        for (const detection of report.detections) {
          detectionsByType[detection.patternId] =
            (detectionsByType[detection.patternId] || 0) + 1;
        }
      }

      return {
        totalSnapshots: snapshots.length,
        totalDetections,
        detectionsByType,
        processingTimeMs: Date.now() - startTimeBt,
      };
    } catch (error) {
      this.logger.error(`Backtest failed: ${error}`);
      throw error;
    }
  }

  /**
   * Export audit trail
   */
  exportAuditTrail(format: 'json' | 'csv' = 'json'): string {
    return this.alertService.exportAlerts(format);
  }

  /**
   * Helper: Update historical data for ML models
   */
  private updateHistoricalData(symbol: string, features: FeatureVector): void {
    // Keep last 1000 feature vectors
    if (!this.historicalFeatures.has(symbol)) {
      this.historicalFeatures.set(symbol, []);
    }

    const featureHistory = this.historicalFeatures.get(symbol)!;
    featureHistory.push(features);
    if (featureHistory.length > 1000) {
      featureHistory.shift();
    }

    // Update volume history
    if (!this.historicalVolumes.has(symbol)) {
      this.historicalVolumes.set(symbol, []);
    }
    const volHistory = this.historicalVolumes.get(symbol)!;
    volHistory.push(features.volumeImbalance);
    if (volHistory.length > 500) {
      volHistory.shift();
    }

    // Update volatility history
    if (!this.historicalVolatility.has(symbol)) {
      this.historicalVolatility.set(symbol, []);
    }
    const volatHistory = this.historicalVolatility.get(symbol)!;
    volatHistory.push(features.volatility);
    if (volatHistory.length > 500) {
      volatHistory.shift();
    }
  }

  /**
   * Helper: Clean expired historical data
   */
  private cleanupHistoricalData(): void {
    // Remove symbols with no activity
    const now = Date.now();
    for (const [symbol, features] of this.historicalFeatures.entries()) {
      const lastFeature = features[features.length - 1];
      if (lastFeature && now - lastFeature.timestamp > this.config.lookbackPeriod) {
        this.historicalFeatures.delete(symbol);
        this.historicalVolumes.delete(symbol);
        this.historicalVolatility.delete(symbol);
      }
    }
  }
}
