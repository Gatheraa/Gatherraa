/**
 * Anomaly Detection Patterns
 * Defines rules and patterns for detecting trading manipulation
 */

import { AnomalyPattern } from './order-book.types';

export class AnomalyPatterns {
  static readonly SPOOFING_LARGE_ORDERS: AnomalyPattern = {
    patternId: 'SPOOFING_LARGE_ORDERS',
    name: 'Large Order Spoofing',
    description:
      'Placement of large orders followed by cancellation before execution. Designed to create false market impression.',
    category: 'SPOOFING',
    severity: 'CRITICAL',
    threshold: 0.85,
    detectionMethod: 'HEURISTIC',
  };

  static readonly SPOOFING_RAPID_CANCEL: AnomalyPattern = {
    patternId: 'SPOOFING_RAPID_CANCEL',
    name: 'Rapid Order Cancellation',
    description: 'Repeated rapid placement and cancellation of orders at same price level.',
    category: 'SPOOFING',
    severity: 'HIGH',
    threshold: 0.80,
    detectionMethod: 'HEURISTIC',
  };

  static readonly LAYERING_BID_SIDE: AnomalyPattern = {
    patternId: 'LAYERING_BID_SIDE',
    name: 'Bid Side Layering',
    description:
      'Placement of multiple orders at different price levels on bid side, with top orders cancelled when traded.',
    category: 'LAYERING',
    severity: 'CRITICAL',
    threshold: 0.85,
    detectionMethod: 'PATTERN_MATCHING',
  };

  static readonly LAYERING_ASK_SIDE: AnomalyPattern = {
    patternId: 'LAYERING_ASK_SIDE',
    name: 'Ask Side Layering',
    description:
      'Placement of multiple orders at different price levels on ask side, with top orders cancelled when traded.',
    category: 'LAYERING',
    severity: 'CRITICAL',
    threshold: 0.85,
    detectionMethod: 'PATTERN_MATCHING',
  };

  static readonly WASH_TRADING_SELF_DEALING: AnomalyPattern = {
    patternId: 'WASH_TRADING_SELF_DEALING',
    name: 'Self-Dealing Wash Trades',
    description:
      'Orders filled at same price with minimal price movement, indicating trades between related parties.',
    category: 'WASH_TRADING',
    severity: 'HIGH',
    threshold: 0.80,
    detectionMethod: 'STATISTICAL',
  };

  static readonly WASH_TRADING_VOLUME_PUMP: AnomalyPattern = {
    patternId: 'WASH_TRADING_VOLUME_PUMP',
    name: 'Volume Pump Wash Trading',
    description: 'Artificial volume creation through repeated trades at same price levels.',
    category: 'WASH_TRADING',
    severity: 'MEDIUM',
    threshold: 0.75,
    detectionMethod: 'STATISTICAL',
  };

  static readonly PUMP_DUMP_COORDINATED: AnomalyPattern = {
    patternId: 'PUMP_DUMP_COORDINATED',
    name: 'Coordinated Pump and Dump',
    description:
      'Coordinated buying activity followed by rapid selling, or vice versa, without fundamental catalyst.',
    category: 'PUMP_DUMP',
    severity: 'HIGH',
    threshold: 0.80,
    detectionMethod: 'ML',
  };

  static readonly PUMP_DUMP_MOMENTUM: AnomalyPattern = {
    patternId: 'PUMP_DUMP_MOMENTUM',
    name: 'Momentum Manipulation',
    description: 'Aggressive trading followed by rapid reversal, creating artificial momentum.',
    category: 'PUMP_DUMP',
    severity: 'MEDIUM',
    threshold: 0.75,
    detectionMethod: 'STATISTICAL',
  };

  static readonly MARKET_MANIPULATION_SPOOFING_SCALP: AnomalyPattern = {
    patternId: 'MARKET_MANIPULATION_SPOOFING_SCALP',
    name: 'Spoofing for Scalping',
    description: 'Large orders placed to move price in desired direction, then cancelled.',
    category: 'MARKET_MANIPULATION',
    severity: 'HIGH',
    threshold: 0.80,
    detectionMethod: 'HEURISTIC',
  };

  static readonly MARKET_MANIPULATION_QUOTE_STUFFING: AnomalyPattern = {
    patternId: 'MARKET_MANIPULATION_QUOTE_STUFFING',
    name: 'Quote Stuffing',
    description:
      'Rapid placement and cancellation of high-volume orders to create market congestion.',
    category: 'MARKET_MANIPULATION',
    severity: 'MEDIUM',
    threshold: 0.75,
    detectionMethod: 'HEURISTIC',
  };

  static readonly MARKET_MANIPULATION_LAYERING_SCALP: AnomalyPattern = {
    patternId: 'MARKET_MANIPULATION_LAYERING_SCALP',
    name: 'Layering for Scalping',
    description: 'Multiple orders placed to create depth illusion, executed selectively.',
    category: 'MARKET_MANIPULATION',
    severity: 'HIGH',
    threshold: 0.80,
    detectionMethod: 'PATTERN_MATCHING',
  };

  static readonly MARKET_MANIPULATION_SPOOFING_REV: AnomalyPattern = {
    patternId: 'MARKET_MANIPULATION_SPOOFING_REV',
    name: 'Reverse Spoofing',
    description: 'Orders placed opposite to intended trade direction to move price, then reversed.',
    category: 'MARKET_MANIPULATION',
    severity: 'HIGH',
    threshold: 0.80,
    detectionMethod: 'HEURISTIC',
  };

  static readonly UNUSUAL_PRICE_VOLATILITY: AnomalyPattern = {
    patternId: 'UNUSUAL_PRICE_VOLATILITY',
    name: 'Unusual Price Volatility',
    description: 'Abnormal price swings inconsistent with order book depth or volume.',
    category: 'MARKET_MANIPULATION',
    severity: 'MEDIUM',
    threshold: 0.70,
    detectionMethod: 'STATISTICAL',
  };

  static readonly UNUSUAL_VOLUME_SPIKE: AnomalyPattern = {
    patternId: 'UNUSUAL_VOLUME_SPIKE',
    name: 'Unusual Volume Spike',
    description: 'Abnormal volume spike without corresponding price movement or fundamental news.',
    category: 'MARKET_MANIPULATION',
    severity: 'LOW',
    threshold: 0.65,
    detectionMethod: 'STATISTICAL',
  };

  static getPatternById(patternId: string): AnomalyPattern | null {
    const patterns = Object.values(AnomalyPatterns).filter(
      (val): val is AnomalyPattern => typeof val === 'object' && 'patternId' in val,
    );
    return patterns.find((p) => p.patternId === patternId) || null;
  }

  static getAllPatterns(): AnomalyPattern[] {
    return Object.values(AnomalyPatterns).filter(
      (val): val is AnomalyPattern => typeof val === 'object' && 'patternId' in val,
    );
  }

  static getPatternsByCategory(category: string): AnomalyPattern[] {
    return AnomalyPatterns.getAllPatterns().filter((p) => p.category === category);
  }

  static getPatternsBySeverity(severity: string): AnomalyPattern[] {
    return AnomalyPatterns.getAllPatterns().filter((p) => p.severity === severity);
  }
}
