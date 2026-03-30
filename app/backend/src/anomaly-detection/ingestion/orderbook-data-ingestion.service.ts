/**
 * Order Book Data Ingestion Pipeline
 * Collects, normalizes, and stores order book data for analysis
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  OrderbookSnapshot,
  OrderbookEvent,
  PriceLevel,
  MarketData,
  TraderProfile,
} from '../types/order-book.types';

export interface DataBuffer {
  snapshots: Map<string, OrderbookSnapshot>;
  events: OrderbookEvent[];
  marketData: Map<string, MarketData>;
  traderProfiles: Map<string, TraderProfile>;
  lastFlush: number;
}

export interface FeatureVector {
  symbol: string;
  timestamp: number;
  traderId?: string;
  
  // Order book features
  spreadBps: number;
  spreadDepthImbalance: number;
  orderbookDepth: number;
  topNLevelImbalance: number;
  
  // Order characteristics
  averageOrderSize: number;
  orderCancellationRate: number;
  orderLifetime: number;
  repeatOrderRate: number;
  
  // Trader features
  traderCancellationRate: number;
  traderFillRate: number;
  traderVolumeConcentration: number;
  
  // Volume features
  volumeImbalance: number;
  volumeConcentration: number;
  unusualVolumeRatio: number;
  
  // Price features
  priceMovement: number;
  volatility: number;
  priceResistance: number;
}

@Injectable()
export class OrderbookDataIngestionService {
  private readonly logger = new Logger(OrderbookDataIngestionService.name);
  private dataBuffer: DataBuffer = {
    snapshots: new Map(),
    events: [],
    marketData: new Map(),
    traderProfiles: new Map(),
    lastFlush: Date.now(),
  };

  private readonly maxBufferSize = 10000;
  private readonly flushIntervalMs = 5000;

  constructor() {
    setInterval(() => this.flushBuffer(), this.flushIntervalMs);
  }

  /**
   * Ingest a new order book snapshot
   */
  ingestOrderbookSnapshot(snapshot: OrderbookSnapshot): void {
    try {
      const key = `${snapshot.symbol}_${snapshot.timestamp}`;
      this.dataBuffer.snapshots.set(key, this.normalizeSnapshot(snapshot));

      if (this.dataBuffer.snapshots.size > this.maxBufferSize) {
        this.flushBuffer();
      }
    } catch (error) {
      this.logger.error(`Failed to ingest orderbook snapshot: ${error}`);
    }
  }

  /**
   * Ingest an order book event
   */
  ingestOrderbookEvent(event: OrderbookEvent): void {
    try {
      const normalizedEvent = this.normalizeEvent(event);
      this.dataBuffer.events.push(normalizedEvent);

      // Update trader profile
      this.updateTraderProfile(event);

      if (this.dataBuffer.events.length > this.maxBufferSize) {
        this.flushBuffer();
      }
    } catch (error) {
      this.logger.error(`Failed to ingest orderbook event: ${error}`);
    }
  }

  /**
   * Ingest market data
   */
  ingestMarketData(marketData: MarketData): void {
    try {
      this.dataBuffer.marketData.set(marketData.symbol, marketData);
    } catch (error) {
      this.logger.error(`Failed to ingest market data: ${error}`);
    }
  }

  /**
   * Get latest order book snapshot for a symbol
   */
  getLatestSnapshot(symbol: string): OrderbookSnapshot | null {
    let latest: OrderbookSnapshot | null = null;
    let latestTime = 0;

    for (const [, snapshot] of this.dataBuffer.snapshots) {
      if (snapshot.symbol === symbol && snapshot.timestamp > latestTime) {
        latest = snapshot;
        latestTime = snapshot.timestamp;
      }
    }

    return latest;
  }

  /**
   * Get recent events for a symbol within a time window
   */
  getRecentEvents(symbol: string, windowMs: number = 60000): OrderbookEvent[] {
    const cutoffTime = Date.now() - windowMs;
    return this.dataBuffer.events.filter(
      (e) => e.symbol === symbol && e.timestamp > cutoffTime,
    );
  }

  /**
   * Get trader profile
   */
  getTraderProfile(traderId: string, symbol?: string): TraderProfile | null {
    const key = symbol ? `${traderId}_${symbol}` : traderId;
    return this.dataBuffer.traderProfiles.get(key) || null;
  }

  /**
   * Extract features from raw data for ML analysis
   */
  extractFeatures(
    symbol: string,
    traderId?: string,
    windowMs: number = 60000,
  ): FeatureVector {
    const snapshot = this.getLatestSnapshot(symbol);
    const events = this.getRecentEvents(symbol, windowMs);
    const traderProfile = traderId
      ? this.getTraderProfile(traderId, symbol)
      : null;

    const features: FeatureVector = {
      symbol,
      timestamp: Date.now(),
      traderId,

      // Order book features
      spreadBps: snapshot ? this.calculateSpreadBps(snapshot) : 0,
      spreadDepthImbalance: snapshot ? this.calculateSpreadImbalance(snapshot) : 0,
      orderbookDepth: snapshot ? this.calculateOrderbookDepth(snapshot) : 0,
      topNLevelImbalance: snapshot ? this.calculateTopNImbalance(snapshot, 5) : 0,

      // Order characteristics
      averageOrderSize: this.calculateAverageOrderSize(events),
      orderCancellationRate: this.calculateCancellationRate(events),
      orderLifetime: this.calculateAverageOrderLifetime(events),
      repeatOrderRate: this.calculateRepeatOrderRate(events),

      // Trader features
      traderCancellationRate: traderProfile?.cancellationRate || 0,
      traderFillRate: traderProfile
        ? traderProfile.totalFilled / Math.max(traderProfile.totalOrders, 1)
        : 0,
      traderVolumeConcentration: traderProfile
        ? this.calculateVolumeConcentration(traderProfile)
        : 0,

      // Volume features
      volumeImbalance: snapshot ? this.calculateVolumeImbalance(snapshot) : 0,
      volumeConcentration: snapshot ? this.calculateVolumeConcentration(snapshot) : 0,
      unusualVolumeRatio: this.calculateUnusualVolumeRatio(events),

      // Price features
      priceMovement: this.calculatePriceMovement(events),
      volatility: this.calculateVolatility(events),
      priceResistance: snapshot ? this.calculatePriceResistance(snapshot) : 0,
    };

    return features;
  }

  /**
   * Normalize order book snapshot
   */
  private normalizeSnapshot(snapshot: OrderbookSnapshot): OrderbookSnapshot {
    return {
      ...snapshot,
      bids: snapshot.bids.sort((a, b) => b.price - a.price).slice(0, 100),
      asks: snapshot.asks.sort((a, b) => a.price - b.price).slice(0, 100),
    };
  }

  /**
   * Normalize order book event
   */
  private normalizeEvent(event: OrderbookEvent): OrderbookEvent {
    return {
      ...event,
      price: Math.max(0, event.price),
      quantity: Math.max(0, event.quantity),
    };
  }

  /**
   * Update trader profile based on event
   */
  private updateTraderProfile(event: OrderbookEvent): void {
    const key = `${event.traderId}_${event.symbol}`;
    let profile = this.dataBuffer.traderProfiles.get(key);

    if (!profile) {
      profile = {
        traderId: event.traderId,
        symbol: event.symbol,
        totalOrders: 0,
        totalCancellations: 0,
        cancellationRate: 0,
        totalFilled: 0,
        totalVolume: 0,
        avgOrderSize: 0,
        orderFrequency: 0,
        lastSeen: Date.now(),
        suspicionScore: 0,
        flags: [],
      };
    }

    profile.lastSeen = event.timestamp;

    switch (event.type) {
      case 'NEW_ORDER':
        profile.totalOrders++;
        profile.totalVolume += event.quantity;
        profile.avgOrderSize = profile.totalVolume / profile.totalOrders;
        break;
      case 'CANCEL_ORDER':
        profile.totalCancellations++;
        profile.cancellationRate =
          profile.totalCancellations / Math.max(profile.totalOrders, 1);
        break;
      case 'FILL_ORDER':
        profile.totalFilled += event.quantity || 0;
        break;
    }

    this.dataBuffer.traderProfiles.set(key, profile);
  }

  /**
   * Feature calculation methods
   */

  private calculateSpreadBps(snapshot: OrderbookSnapshot): number {
    if (snapshot.bids.length === 0 || snapshot.asks.length === 0) return 0;
    const midPrice = (snapshot.bids[0].price + snapshot.asks[0].price) / 2;
    return ((snapshot.asks[0].price - snapshot.bids[0].price) / midPrice) * 10000;
  }

  private calculateSpreadImbalance(snapshot: OrderbookSnapshot): number {
    if (snapshot.bids.length === 0 || snapshot.asks.length === 0) return 0;
    const bidDepth = snapshot.bids.reduce((sum, level) => sum + level.quantity, 0);
    const askDepth = snapshot.asks.reduce((sum, level) => sum + level.quantity, 0);
    const totalDepth = bidDepth + askDepth;
    return totalDepth === 0 ? 0 : Math.abs(bidDepth - askDepth) / totalDepth;
  }

  private calculateOrderbookDepth(snapshot: OrderbookSnapshot): number {
    const midPrice = (snapshot.bids[0]?.price + snapshot.asks[0]?.price) / 2 || 0;
    if (midPrice === 0) return 0;

    let depth = 0;
    for (const bid of snapshot.bids) {
      depth += bid.quantity * (1 - (midPrice - bid.price) / midPrice);
    }
    for (const ask of snapshot.asks) {
      depth += ask.quantity * (1 - (ask.price - midPrice) / midPrice);
    }
    return depth;
  }

  private calculateTopNImbalance(snapshot: OrderbookSnapshot, n: number): number {
    const topBids = snapshot.bids.slice(0, n);
    const topAsks = snapshot.asks.slice(0, n);
    const bidVolume = topBids.reduce((sum, level) => sum + level.quantity, 0);
    const askVolume = topAsks.reduce((sum, level) => sum + level.quantity, 0);
    const totalVolume = bidVolume + askVolume;
    return totalVolume === 0 ? 0 : Math.abs(bidVolume - askVolume) / totalVolume;
  }

  private calculateAverageOrderSize(events: OrderbookEvent[]): number {
    const newOrders = events.filter((e) => e.type === 'NEW_ORDER');
    if (newOrders.length === 0) return 0;
    return newOrders.reduce((sum, e) => sum + e.quantity, 0) / newOrders.length;
  }

  private calculateCancellationRate(events: OrderbookEvent[]): number {
    const newOrders = events.filter((e) => e.type === 'NEW_ORDER').length;
    const cancelledOrders = events.filter((e) => e.type === 'CANCEL_ORDER').length;
    return newOrders === 0 ? 0 : cancelledOrders / newOrders;
  }

  private calculateAverageOrderLifetime(events: OrderbookEvent[]): number {
    const orderLifetimes: number[] = [];

    for (const order of events.filter((e) => e.type === 'NEW_ORDER')) {
      const cancelEvent = events.find(
        (e) => e.type === 'CANCEL_ORDER' && e.orderId === order.orderId,
      );
      const fillEvent = events.find(
        (e) => e.type === 'FILL_ORDER' && e.orderId === order.orderId,
      );

      const endTime = cancelEvent?.timestamp || fillEvent?.timestamp;
      if (endTime) {
        orderLifetimes.push(endTime - order.timestamp);
      }
    }

    if (orderLifetimes.length === 0) return 0;
    return orderLifetimes.reduce((sum, lt) => sum + lt, 0) / orderLifetimes.length;
  }

  private calculateRepeatOrderRate(events: OrderbookEvent[]): number {
    const prices = events.map((e) => e.price);
    const priceCount = new Map<number, number>();
    prices.forEach((p) => priceCount.set(p, (priceCount.get(p) || 0) + 1));

    const repeatCount = Array.from(priceCount.values()).filter((c) => c > 1).length;
    return prices.length === 0 ? 0 : repeatCount / prices.length;
  }

  private calculateVolumeImbalance(snapshot: OrderbookSnapshot): number {
    const bidVolume = snapshot.bids.reduce((sum, level) => sum + level.quantity, 0);
    const askVolume = snapshot.asks.reduce((sum, level) => sum + level.quantity, 0);
    const totalVolume = bidVolume + askVolume;
    return totalVolume === 0 ? 0 : Math.abs(bidVolume - askVolume) / totalVolume;
  }

  private calculateVolumeConcentration(
    input: OrderbookSnapshot | TraderProfile,
  ): number {
    if ('bids' in input) {
      // OrderbookSnapshot
      const snapshot = input as OrderbookSnapshot;
      const bids = snapshot.bids.slice(0, 5);
      const totalBidVolume = snapshot.bids.reduce((sum, l) => sum + l.quantity, 0);
      const topBidVolume = bids.reduce((sum, l) => sum + l.quantity, 0);
      return totalBidVolume === 0 ? 0 : topBidVolume / totalBidVolume;
    } else {
      // TraderProfile
      const profile = input as TraderProfile;
      return profile.totalOrders === 0 ? 0 : 1 / profile.totalOrders;
    }
  }

  private calculateUnusualVolumeRatio(events: OrderbookEvent[]): number {
    const volumes = events
      .filter((e) => e.type === 'FILL_ORDER')
      .map((e) => e.quantity);
    if (volumes.length < 2) return 0;

    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const maxVolume = Math.max(...volumes);
    return avgVolume === 0 ? 0 : maxVolume / avgVolume;
  }

  private calculatePriceMovement(events: OrderbookEvent[]): number {
    if (events.length < 2) return 0;
    const prices = events.map((e) => e.price);
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    return firstPrice === 0 ? 0 : Math.abs(lastPrice - firstPrice) / firstPrice;
  }

  private calculateVolatility(events: OrderbookEvent[]): number {
    const prices = events.map((e) => e.price);
    if (prices.length < 2) return 0;

    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance =
      prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
    return Math.sqrt(variance) / mean;
  }

  private calculatePriceResistance(snapshot: OrderbookSnapshot): number {
    // Price resistance: how many price levels before reaching significant volume
    const midPrice = (snapshot.bids[0]?.price + snapshot.asks[0]?.price) / 2 || 0;
    let totalVolume = 0;
    let levelsChecked = 0;
    const targetVolume = 100000; // $100k

    for (const ask of snapshot.asks) {
      totalVolume += ask.quantity;
      levelsChecked++;
      if (totalVolume >= targetVolume) break;
    }

    return levelsChecked / Math.max(snapshot.asks.length, 1);
  }

  /**
   * Flush buffer to persistent storage
   */
  private flushBuffer(): void {
    try {
      // In a real implementation, this would persist to database
      this.logger.debug(
        `Flushing buffer: ${this.dataBuffer.snapshots.size} snapshots, ${this.dataBuffer.events.length} events`,
      );
      this.dataBuffer.events = [];
      this.dataBuffer.lastFlush = Date.now();
    } catch (error) {
      this.logger.error(`Failed to flush buffer: ${error}`);
    }
  }

  /**
   * Get buffer statistics
   */
  getBufferStats() {
    return {
      snapshots: this.dataBuffer.snapshots.size,
      events: this.dataBuffer.events.length,
      marketData: this.dataBuffer.marketData.size,
      traderProfiles: this.dataBuffer.traderProfiles.size,
      lastFlush: this.dataBuffer.lastFlush,
    };
  }
}
