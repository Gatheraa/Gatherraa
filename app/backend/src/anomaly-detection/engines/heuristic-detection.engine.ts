/**
 * Heuristic Anomaly Detection Engine
 * Implements detection rules for spoofing, layering, and other market manipulation
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  OrderbookSnapshot,
  OrderbookEvent,
  DetectionResult,
  AnomalyEvidence,
  FeatureVector,
} from '../types/order-book.types';
import { AnomalyPatterns } from '../patterns/anomaly-patterns';

@Injectable()
export class HeuristicDetectionEngine {
  private readonly logger = new Logger(HeuristicDetectionEngine.name);

  /**
   * Detect spoofing patterns (large orders followed by cancellation)
   */
  detectSpoofing(events: OrderbookEvent[], snapshot: OrderbookSnapshot): DetectionResult[] {
    const results: DetectionResult[] = [];

    // Detect large orders followed by rapid cancellations
    const largeOrders = events
      .filter((e) => e.type === 'NEW_ORDER' && e.quantity > 10000)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    for (const order of largeOrders) {
      const cancelledAfter = events.filter(
        (e) =>
          e.type === 'CANCEL_ORDER' &&
          e.orderId === order.orderId &&
          e.timestamp - order.timestamp < 5000, // Cancelled within 5 seconds
      );

      if (cancelledAfter.length > 0) {
        const evidence: AnomalyEvidence[] = [
          {
            type: 'ORDER_SIZE',
            value: order.quantity,
            threshold: 10000,
            description: `Large order placed: ${order.quantity} units`,
          },
          {
            type: 'CANCELLATION_TIME',
            value: cancelledAfter[0].timestamp - order.timestamp,
            threshold: 5000,
            description: `Order cancelled within ${cancelledAfter[0].timestamp - order.timestamp}ms`,
          },
        ];

        results.push({
          patternId: AnomalyPatterns.SPOOFING_LARGE_ORDERS.patternId,
          patternName: AnomalyPatterns.SPOOFING_LARGE_ORDERS.name,
          severity: AnomalyPatterns.SPOOFING_LARGE_ORDERS.severity,
          confidence: 0.95,
          timestamp: Date.now(),
          symbol: order.symbol,
          traderId: order.traderId,
          evidence,
          metrics: {
            orderSize: order.quantity,
            cancellationTime: cancelledAfter[0].timestamp - order.timestamp,
            priceLevel: order.price,
          },
          explainability: `Trader ${order.traderId} placed a large order of ${order.quantity} units at price ${order.price}, then cancelled it within ${cancelledAfter[0].timestamp - order.timestamp}ms. This suggests spoofing behavior to manipulate price.`,
        });
      }
    }

    // Detect rapid placement and cancellation at same level
    const priceMap = new Map<number, OrderbookEvent[]>();
    events.forEach((e) => {
      if (!priceMap.has(e.price)) {
        priceMap.set(e.price, []);
      }
      priceMap.get(e.price)!.push(e);
    });

    for (const [price, eventsAtPrice] of priceMap) {
      const newOrders = eventsAtPrice.filter((e) => e.type === 'NEW_ORDER');
      const cancellations = eventsAtPrice.filter((e) => e.type === 'CANCEL_ORDER');

      if (newOrders.length >= 3 && cancellations.length >= 2) {
        const avgTimeBetween =
          (newOrders[newOrders.length - 1].timestamp - newOrders[0].timestamp) /
          (newOrders.length - 1);

        if (avgTimeBetween < 1000) {
          // Less than 1 second between orders
          const evidence: AnomalyEvidence[] = [
            {
              type: 'RAPID_ORDERS',
              value: newOrders.length,
              threshold: 3,
              description: `${newOrders.length} new orders at same price level`,
            },
            {
              type: 'RAPID_CANCELLATIONS',
              value: cancellations.length,
              threshold: 2,
              description: `${cancellations.length} cancellations at same price level`,
            },
            {
              type: 'TIME_BETWEEN_ORDERS',
              value: avgTimeBetween,
              threshold: 1000,
              description: `Average ${avgTimeBetween.toFixed(0)}ms between orders`,
            },
          ];

          results.push({
            patternId: AnomalyPatterns.SPOOFING_RAPID_CANCEL.patternId,
            patternName: AnomalyPatterns.SPOOFING_RAPID_CANCEL.name,
            severity: AnomalyPatterns.SPOOFING_RAPID_CANCEL.severity,
            confidence: 0.85,
            timestamp: Date.now(),
            symbol: eventsAtPrice[0].symbol,
            traderId: eventsAtPrice[0].traderId,
            evidence,
            metrics: {
              priceLevel: price,
              orderCount: newOrders.length,
              cancellationCount: cancellations.length,
              avgTimeBetween,
            },
            explainability: `Detected rapid order placement (${newOrders.length} orders in ${avgTimeBetween.toFixed(0)}ms) followed by cancellations at price level ${price}. This is characteristic of spoofing.`,
          });
        }
      }
    }

    return results;
  }

  /**
   * Detect layering patterns (multiple orders at different levels, cancelled when touched)
   */
  detectLayering(events: OrderbookEvent[], snapshot: OrderbookSnapshot): DetectionResult[] {
    const results: DetectionResult[] = [];

    // Separate bid and ask events
    const bidEvents = events.filter((e) => e.side === 'BUY');
    const askEvents = events.filter((e) => e.side === 'SELL');

    // Analyze bid side layering
    results.push(
      ...this.analyzeLayeringBySide(bidEvents, 'LAYERING_BID_SIDE', 'BID'),
    );

    // Analyze ask side layering
    results.push(
      ...this.analyzeLayeringBySide(askEvents, 'LAYERING_ASK_SIDE', 'ASK'),
    );

    return results;
  }

  /**
   * Detect wash trading patterns
   */
  detectWashTrading(events: OrderbookEvent[]): DetectionResult[] {
    const results: DetectionResult[] = [];

    // Identify potential self-dealing
    const tradeEvents = events.filter((e) => e.type === 'FILL_ORDER');

    // Look for trades at identical prices with minimal spread
    const priceMap = new Map<number, OrderbookEvent[]>();
    tradeEvents.forEach((e) => {
      if (!priceMap.has(e.price)) {
        priceMap.set(e.price, []);
      }
      priceMap.get(e.price)!.push(e);
    });

    for (const [price, tradesAtPrice] of priceMap) {
      // Check if trades have both buy and sell sides at same price
      const buys = tradesAtPrice.filter((t) => t.side === 'BUY');
      const sells = tradesAtPrice.filter((t) => t.side === 'SELL');

      if (buys.length >= 2 && sells.length >= 2) {
        const buyVolume = buys.reduce((sum, t) => sum + t.quantity, 0);
        const sellVolume = sells.reduce((sum, t) => sum + t.quantity, 0);
        const volumeDifference = Math.abs(buyVolume - sellVolume) / Math.max(buyVolume, sellVolume);

        if (volumeDifference < 0.1) {
          // Less than 10% difference in volume
          const evidence: AnomalyEvidence[] = [
            {
              type: 'SAME_PRICE_TRADES',
              value: buys.length + sells.length,
              threshold: 4,
              description: `${buys.length + sells.length} trades at same price ${price}`,
            },
            {
              type: 'VOLUME_BALANCE',
              value: volumeDifference,
              threshold: 0.1,
              description: `Buy and sell volumes differ by only ${(volumeDifference * 100).toFixed(1)}%`,
            },
          ];

          results.push({
            patternId: AnomalyPatterns.WASH_TRADING_SELF_DEALING.patternId,
            patternName: AnomalyPatterns.WASH_TRADING_SELF_DEALING.name,
            severity: AnomalyPatterns.WASH_TRADING_SELF_DEALING.severity,
            confidence: 0.80,
            timestamp: Date.now(),
            symbol: tradesAtPrice[0].symbol,
            evidence,
            metrics: {
              priceLevel: price,
              buyVolume,
              sellVolume,
              buyTradeCount: buys.length,
              sellTradeCount: sells.length,
            },
            explainability: `Detected ${buys.length} buy trades and ${sells.length} sell trades at the same price level (${price}) with nearly matched volumes. This suggests wash trading or self-dealing.`,
          });
        }
      }
    }

    return results;
  }

  /**
   * Detect pump and dump patterns
   */
  detectPumpDump(events: OrderbookEvent[], features: FeatureVector): DetectionResult[] {
    const results: DetectionResult[] = [];

    // Detect coordinated buying followed by selling
    const timeWindows = this.createTimeWindows(events, 60000); // 1-minute windows

    for (const window of timeWindows) {
      const buys = window.filter((e) => e.type === 'FILL_ORDER' && e.side === 'BUY');
      const sells = window.filter((e) => e.type === 'FILL_ORDER' && e.side === 'SELL');

      const buyVolume = buys.reduce((sum, e) => sum + e.quantity, 0);
      const sellVolume = sells.reduce((sum, e) => sum + e.quantity, 0);
      const buyPrice = buys.length > 0 ? buys.reduce((sum, e) => sum + e.price, 0) / buys.length : 0;
      const sellPrice = sells.length > 0 ? sells.reduce((sum, e) => sum + e.price, 0) / sells.length : 0;

      // Check for aggressive buying followed by aggressive selling
      if (buyVolume > 50000 && sellVolume > 50000 && buyPrice < sellPrice) {
        const priceIncrease = (sellPrice - buyPrice) / buyPrice;

        if (priceIncrease > 0.02) {
          // Price increase > 2%
          const evidence: AnomalyEvidence[] = [
            {
              type: 'BUY_VOLUME',
              value: buyVolume,
              threshold: 50000,
              description: `Large buy volume: ${buyVolume}`,
            },
            {
              type: 'SELL_VOLUME',
              value: sellVolume,
              threshold: 50000,
              description: `Large sell volume: ${sellVolume}`,
            },
            {
              type: 'PRICE_INCREASE',
              value: priceIncrease,
              threshold: 0.02,
              description: `Price increased by ${(priceIncrease * 100).toFixed(2)}%`,
            },
          ];

          results.push({
            patternId: AnomalyPatterns.PUMP_DUMP_COORDINATED.patternId,
            patternName: AnomalyPatterns.PUMP_DUMP_COORDINATED.name,
            severity: AnomalyPatterns.PUMP_DUMP_COORDINATED.severity,
            confidence: 0.75,
            timestamp: Date.now(),
            symbol: window[0].symbol,
            evidence,
            metrics: {
              buyVolume,
              sellVolume,
              buyPrice,
              sellPrice,
              priceIncrease,
            },
            explainability: `Detected aggressive coordinated buying (${buyVolume} units at ${buyPrice.toFixed(2)}) followed by aggressive selling (${sellVolume} units at ${sellPrice.toFixed(2)}), creating a ${(priceIncrease * 100).toFixed(2)}% price increase. Pattern suggests pump and dump manipulation.`,
          });
        }
      }
    }

    return results;
  }

  /**
   * Helper: Analyze layering on one side (bid or ask)
   */
  private analyzeLayeringBySide(
    sideEvents: OrderbookEvent[],
    patternId: string,
    side: string,
  ): DetectionResult[] {
    const results: DetectionResult[] = [];

    // Group by trader
    const traderMap = new Map<string, OrderbookEvent[]>();
    sideEvents.forEach((e) => {
      if (!traderMap.has(e.traderId)) {
        traderMap.set(e.traderId, []);
      }
      traderMap.get(e.traderId)!.push(e);
    });

    for (const [traderId, traderEvents] of traderMap) {
      // Sort by price
      const sorted = [...traderEvents].sort((a, b) => b.price - a.price);

      // Check for multiple orders at different price levels
      if (sorted.length >= 3) {
        const priceLevels = new Map<number, OrderbookEvent[]>();
        sorted.forEach((e) => {
          if (!priceLevels.has(e.price)) {
            priceLevels.set(e.price, []);
          }
          priceLevels.get(e.price)!.push(e);
        });

        if (priceLevels.size >= 3) {
          // Check if top order gets cancelled when price moves
          const topOrder = sorted[0];
          const topOrderCancelled = sorted.some(
            (e) =>
              e.type === 'CANCEL_ORDER' &&
              e.orderId === topOrder.orderId &&
              e.timestamp - topOrder.timestamp < 30000,
          );

          if (topOrderCancelled) {
            const evidence: AnomalyEvidence[] = [
              {
                type: 'MULTIPLE_LEVELS',
                value: priceLevels.size,
                threshold: 3,
                description: `Orders placed at ${priceLevels.size} different price levels`,
              },
              {
                type: 'TOP_ORDER_CANCELLED',
                value: 1,
                threshold: 0,
                description: `Top order cancelled shortly after placement`,
              },
            ];

            results.push({
              patternId,
              patternName: patternId === 'LAYERING_BID_SIDE' ? 'Bid Side Layering' : 'Ask Side Layering',
              severity: 'CRITICAL',
              confidence: 0.85,
              timestamp: Date.now(),
              symbol: topOrder.symbol,
              traderId,
              evidence,
              metrics: {
                priceLevelCount: priceLevels.size,
                topPrice: topOrder.price,
                orderCount: sorted.length,
              },
              explainability: `Trader ${traderId} placed orders at ${priceLevels.size} different price levels on the ${side} side. The top order was cancelled shortly after, which is characteristic of layering manipulation to create false depth.`,
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Helper: Create time windows for analysis
   */
  private createTimeWindows(events: OrderbookEvent[], windowSize: number): OrderbookEvent[][] {
    const windows: OrderbookEvent[][] = [];
    const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

    let currentWindow: OrderbookEvent[] = [];
    let windowStart = sortedEvents[0]?.timestamp || 0;

    for (const event of sortedEvents) {
      if (event.timestamp - windowStart >= windowSize) {
        if (currentWindow.length > 0) {
          windows.push(currentWindow);
        }
        currentWindow = [event];
        windowStart = event.timestamp;
      } else {
        currentWindow.push(event);
      }
    }

    if (currentWindow.length > 0) {
      windows.push(currentWindow);
    }

    return windows;
  }
}
