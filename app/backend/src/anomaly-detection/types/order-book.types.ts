/**
 * Order Book Anomaly Detection Types
 * Defines data structures for order book monitoring and pattern detection
 */

export interface OrderbookSnapshot {
  timestamp: number;
  symbol: string;
  bids: PriceLevel[];
  asks: PriceLevel[];
  sequence: number;
  exchangeId: string;
}

export interface PriceLevel {
  price: number;
  quantity: number;
  orderId?: string;
  traderId?: string;
  timestamp?: number;
}

export interface OrderbookEvent {
  type: 'NEW_ORDER' | 'CANCEL_ORDER' | 'FILL_ORDER' | 'REPLACE_ORDER';
  timestamp: number;
  symbol: string;
  orderId: string;
  traderId: string;
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  originalQuantity?: number;
  newQuantity?: number;
  newPrice?: number;
  fillQuantity?: number;
  sequence: number;
}

export interface MarketData {
  timestamp: number;
  symbol: string;
  bestBid: number;
  bestAsk: number;
  spreadBps: number;
  volume24h: number;
  lastTrade: TradeInfo;
  vwap: number;
}

export interface TradeInfo {
  price: number;
  quantity: number;
  timestamp: number;
  side: 'BUY' | 'SELL';
  aggressor: string;
}

export interface AnomalyPattern {
  patternId: string;
  name: string;
  description: string;
  category: 'SPOOFING' | 'LAYERING' | 'WASH_TRADING' | 'PUMP_DUMP' | 'MARKET_MANIPULATION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  threshold: number;
  detectionMethod: 'HEURISTIC' | 'ML' | 'STATISTICAL' | 'PATTERN_MATCHING';
}

export interface DetectionResult {
  patternId: string;
  patternName: string;
  severity: string;
  confidence: number;
  timestamp: number;
  symbol: string;
  traderId?: string;
  evidence: AnomalyEvidence[];
  metrics: Record<string, number>;
  explainability: string;
}

export interface AnomalyEvidence {
  type: string;
  value: number;
  threshold: number;
  description: string;
}

export interface TraderProfile {
  traderId: string;
  symbol: string;
  totalOrders: number;
  totalCancellations: number;
  cancellationRate: number;
  totalFilled: number;
  totalVolume: number;
  avgOrderSize: number;
  orderFrequency: number;
  lastSeen: number;
  suspicionScore: number;
  flags: string[];
}

export interface AnomalyAlert {
  alertId: string;
  detectionId: string;
  timestamp: number;
  symbol: string;
  patternName: string;
  severity: string;
  confidence: number;
  traderId?: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE';
  actions: AnomalyAction[];
  explainability: AnomalyExplanation;
}

export interface AnomalyAction {
  type: 'THROTTLE' | 'BLOCK' | 'ALERT' | 'ESCALATE' | 'AUTO_BAN' | 'REVIEW';
  status: 'PENDING' | 'EXECUTED' | 'FAILED';
  timestamp: number;
  parameters?: Record<string, any>;
  result?: string;
}

export interface AnomalyExplanation {
  summary: string;
  indicators: ExplanationIndicator[];
  relatedPatterns: string[];
  confidence: number;
  historicalContext?: string;
}

export interface ExplanationIndicator {
  name: string;
  value: number;
  threshold: number;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
}

export interface AnomalyStatistics {
  symbol: string;
  periodStart: number;
  periodEnd: number;
  totalDetections: number;
  byPattern: Record<string, number>;
  bySeverity: Record<string, number>;
  byTraderId: Record<string, number>;
  falsePositiveRate: number;
  truePositiveRate: number;
}

export interface AnomalyConfig {
  enabledPatterns: string[];
  alertThreshold: number;
  throttleThreshold: number;
  blockThreshold: number;
  windowSize: number;
  lookbackPeriod: number;
  mlEnabled: boolean;
  heuristicsEnabled: boolean;
  explainabilityLevel: 'BASIC' | 'DETAILED' | 'COMPREHENSIVE';
}
