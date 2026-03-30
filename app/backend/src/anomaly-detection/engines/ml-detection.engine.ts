/**
 * Machine Learning & Statistical Anomaly Detection Engine
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  DetectionResult,
  AnomalyEvidence,
  FeatureVector,
} from '../types/order-book.types';
import { AnomalyPatterns } from '../patterns/anomaly-patterns';

@Injectable()
export class MLDetectionEngine {
  private readonly logger = new Logger(MLDetectionEngine.name);

  // Simple ML models (in production, use TensorFlow.js or Python service)
  private isolationForestThresholds = {
    UNUSUAL_VOLUME_SPIKE: 2.5,
    UNUSUAL_PRICE_VOLATILITY: 2.0,
    PUMP_DUMP_COORDINATED: 2.2,
  };

  /**
   * Detect unusual volume spikes using statistical analysis
   */
  detectUnusualVolumeSpike(
    features: FeatureVector,
    historicalVolumes: number[],
  ): DetectionResult[] {
    const results: DetectionResult[] = [];

    if (historicalVolumes.length < 10) return results;

    const mean = this.calculateMean(historicalVolumes);
    const stdDev = this.calculateStdDev(historicalVolumes, mean);
    const currentVolume = features.volumeImbalance;
    const zScore = (currentVolume - mean) / stdDev;

    if (Math.abs(zScore) > this.isolationForestThresholds.UNUSUAL_VOLUME_SPIKE) {
      const evidence: AnomalyEvidence[] = [
        {
          type: 'Z_SCORE',
          value: zScore,
          threshold: this.isolationForestThresholds.UNUSUAL_VOLUME_SPIKE,
          description: `Z-score: ${zScore.toFixed(2)}, threshold: ${this.isolationForestThresholds.UNUSUAL_VOLUME_SPIKE}`,
        },
        {
          type: 'VOLUME_IMBALANCE',
          value: currentVolume,
          threshold: mean + 2 * stdDev,
          description: `Volume imbalance: ${currentVolume.toFixed(4)}, mean: ${mean.toFixed(4)}`,
        },
      ];

      results.push({
        patternId: AnomalyPatterns.UNUSUAL_VOLUME_SPIKE.patternId,
        patternName: AnomalyPatterns.UNUSUAL_VOLUME_SPIKE.name,
        severity: AnomalyPatterns.UNUSUAL_VOLUME_SPIKE.severity,
        confidence: Math.min(0.95, 0.5 + Math.abs(zScore) / 10),
        timestamp: Date.now(),
        symbol: features.symbol,
        traderId: features.traderId,
        evidence,
        metrics: {
          zScore,
          mean,
          stdDev,
          volumeImbalance: currentVolume,
        },
        explainability: `Statistical analysis detected an unusual volume spike with Z-score of ${zScore.toFixed(2)}, which is ${Math.abs(zScore).toFixed(2)} standard deviations from the mean. This suggests abnormal volume activity.`,
      });
    }

    return results;
  }

  /**
   * Detect unusual price volatility
   */
  detectUnusualVolatility(
    features: FeatureVector,
    historicalVolatility: number[],
  ): DetectionResult[] {
    const results: DetectionResult[] = [];

    if (historicalVolatility.length < 10) return results;

    const mean = this.calculateMean(historicalVolatility);
    const stdDev = this.calculateStdDev(historicalVolatility, mean);
    const currentVolatility = features.volatility;
    const zScore = (currentVolatility - mean) / stdDev;

    if (Math.abs(zScore) > this.isolationForestThresholds.UNUSUAL_PRICE_VOLATILITY) {
      const evidence: AnomalyEvidence[] = [
        {
          type: 'VOLATILITY_Z_SCORE',
          value: zScore,
          threshold: this.isolationForestThresholds.UNUSUAL_PRICE_VOLATILITY,
          description: `Volatility Z-score: ${zScore.toFixed(2)}`,
        },
        {
          type: 'PRICE_MOVEMENT',
          value: features.priceMovement,
          threshold: mean + 2 * stdDev,
          description: `Price movement: ${(features.priceMovement * 100).toFixed(2)}%`,
        },
      ];

      results.push({
        patternId: AnomalyPatterns.UNUSUAL_PRICE_VOLATILITY.patternId,
        patternName: AnomalyPatterns.UNUSUAL_PRICE_VOLATILITY.name,
        severity: AnomalyPatterns.UNUSUAL_PRICE_VOLATILITY.severity,
        confidence: Math.min(0.90, 0.5 + Math.abs(zScore) / 10),
        timestamp: Date.now(),
        symbol: features.symbol,
        evidence,
        metrics: {
          volatilityZScore: zScore,
          mean,
          stdDev,
          currentVolatility,
          priceMovement: features.priceMovement,
        },
        explainability: `Detected unusual price volatility of ${(currentVolatility * 100).toFixed(2)}%, which is ${zScore.toFixed(2)} standard deviations from the historical mean. This suggests abnormal price action inconsistent with normal market conditions.`,
      });
    }

    return results;
  }

  /**
   * Isolation Forest-based anomaly detection
   * Detects multi-dimensional anomalies in feature space
   */
  detectMultidimensionalAnomalies(
    features: FeatureVector,
    features_historical: FeatureVector[],
  ): DetectionResult[] {
    const results: DetectionResult[] = [];

    // Simple implementation: calculate distance in normalized feature space
    const normalizedFeatures = this.normalizeFeatures(features);
    const avgDistance = this.calculateAverageDistance(
      normalizedFeatures,
      features_historical.map((f) => this.normalizeFeatures(f)),
    );

    // If distance is significantly different from historical, flag as anomaly
    const distances = features_historical.map((f) =>
      this.calculateDistance(normalizedFeatures, this.normalizeFeatures(f)),
    );
    const distanceMean = this.calculateMean(distances);
    const distanceStdDev = this.calculateStdDev(distances, distanceMean);
    const zScore = (avgDistance - distanceMean) / distanceStdDev;

    if (Math.abs(zScore) > 2.5) {
      const suspiciousFeatures = this.identifySuspiciousFeatures(
        features,
        features_historical,
      );

      const evidence: AnomalyEvidence[] = suspiciousFeatures.map((name) => ({
        type: `FEATURE_${name.toUpperCase()}`,
        value: (features as any)[name],
        threshold: this.calculateFeatureThreshold(name, features_historical),
        description: `Feature ${name} deviates significantly from historical baseline`,
      }));

      results.push({
        patternId: AnomalyPatterns.PUMP_DUMP_COORDINATED.patternId,
        patternName: 'Coordinated Market Manipulation',
        severity: 'HIGH',
        confidence: Math.min(0.85, 0.5 + Math.abs(zScore) / 10),
        timestamp: Date.now(),
        symbol: features.symbol,
        traderId: features.traderId,
        evidence,
        metrics: {
          anomalyScore: avgDistance,
          zScore,
          suspiciousFeatureCount: suspiciousFeatures.length,
        },
        explainability: `Detected multi-dimensional anomaly with combined anomaly score of ${avgDistance.toFixed(3)}, involving ${suspiciousFeatures.length} features that deviate from normal patterns: ${suspiciousFeatures.join(', ')}`,
      });
    }

    return results;
  }

  /**
   * Detect quote stuffing (rapid order placement/cancellation)
   */
  detectQuoteStuffing(orderFrequency: number, orderLifetime: number): DetectionResult[] {
    const results: DetectionResult[] = [];

    // Quote stuffing: >1000 orders/second with <100ms average lifetime
    if (orderFrequency > 1000 && orderLifetime < 100) {
      const evidence: AnomalyEvidence[] = [
        {
          type: 'ORDER_FREQUENCY',
          value: orderFrequency,
          threshold: 1000,
          description: `${orderFrequency} orders per second`,
        },
        {
          type: 'ORDER_LIFETIME',
          value: orderLifetime,
          threshold: 100,
          description: `Average order lifetime: ${orderLifetime.toFixed(0)}ms`,
        },
      ];

      results.push({
        patternId: AnomalyPatterns.MARKET_MANIPULATION_QUOTE_STUFFING.patternId,
        patternName: AnomalyPatterns.MARKET_MANIPULATION_QUOTE_STUFFING.name,
        severity: AnomalyPatterns.MARKET_MANIPULATION_QUOTE_STUFFING.severity,
        confidence: 0.90,
        timestamp: Date.now(),
        symbol: '',
        evidence,
        metrics: {
          orderFrequency,
          orderLifetime,
          riskScore: (orderFrequency / 1000) * (100 / Math.max(orderLifetime, 1)),
        },
        explainability: `Detected quote stuffing with extremely high order frequency (${orderFrequency}/sec) and very short order lifetimes (${orderLifetime.toFixed(0)}ms). This suggests market manipulation through congestion.`,
      });
    }

    return results;
  }

  /**
   * Calculate feature importance through gradient-based analysis
   */
  calculateFeatureImportance(
    features: FeatureVector,
    anomalyScore: number,
  ): Record<string, number> {
    const importance: Record<string, number> = {};
    const featureNames = Object.keys(features).filter(
      (k) => typeof (features as any)[k] === 'number',
    );

    for (const featureName of featureNames) {
      const baseValue = (features as any)[featureName];

      // Numeric gradient approximation
      const perturbation = Math.max(Math.abs(baseValue) * 0.01, 0.001);
      const perturbedFeatures = { ...features };
      (perturbedFeatures as any)[featureName] = baseValue + perturbation;

      // Simplified importance: how much feature contributes to anomaly score
      const normalizedPerturbed = this.normalizeFeatures(perturbedFeatures);
      const normalizedBase = this.normalizeFeatures(features);
      const gradientMagnitude = this.calculateDistance(
        normalizedBase,
        normalizedPerturbed,
      );

      importance[featureName] = Math.abs(gradientMagnitude) * Math.abs(baseValue);
    }

    return importance;
  }

  /**
   * Helper: Normalize features to 0-1 range
   */
  private normalizeFeatures(features: FeatureVector): number[] {
    const values = Object.values(features).filter((v) => typeof v === 'number') as number[];
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;

    return values.map((v) => (v - min) / range);
  }

  /**
   * Helper: Calculate Euclidean distance between two feature vectors
   */
  private calculateDistance(v1: number[], v2: number[]): number {
    let sum = 0;
    for (let i = 0; i < Math.min(v1.length, v2.length); i++) {
      sum += Math.pow(v1[i] - v2[i], 2);
    }
    return Math.sqrt(sum);
  }

  /**
   * Helper: Calculate average distance from historical features
   */
  private calculateAverageDistance(
    current: number[],
    historical: number[][],
  ): number {
    if (historical.length === 0) return 0;
    const distances = historical.map((h) => this.calculateDistance(current, h));
    return distances.reduce((a, b) => a + b, 0) / distances.length;
  }

  /**
   * Helper: Identify which features are suspicious
   */
  private identifySuspiciousFeatures(
    current: FeatureVector,
    historical: FeatureVector[],
  ): string[] {
    const suspicious: string[] = [];
    const featureNames = Object.keys(current).filter(
      (k) => typeof (current as any)[k] === 'number',
    );

    for (const featureName of featureNames) {
      const currentValue = (current as any)[featureName];
      const historicalValues = historical.map((f) => (f as any)[featureName]).filter((v) => typeof v === 'number');

      if (historicalValues.length >= 5) {
        const mean = this.calculateMean(historicalValues);
        const stdDev = this.calculateStdDev(historicalValues, mean);
        const zScore = (currentValue - mean) / (stdDev || 1);

        if (Math.abs(zScore) > 2) {
          suspicious.push(featureName);
        }
      }
    }

    return suspicious;
  }

  /**
   * Helper: Calculate feature threshold
   */
  private calculateFeatureThreshold(
    featureName: string,
    historical: FeatureVector[],
  ): number {
    const values = historical
      .map((f) => (f as any)[featureName])
      .filter((v) => typeof v === 'number');

    if (values.length === 0) return 0;

    const mean = this.calculateMean(values);
    const stdDev = this.calculateStdDev(values, mean);
    return mean + 2 * stdDev;
  }

  /**
   * Helper: Calculate mean
   */
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Helper: Calculate standard deviation
   */
  private calculateStdDev(values: number[], mean: number): number {
    if (values.length < 2) return 0;
    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }
}
