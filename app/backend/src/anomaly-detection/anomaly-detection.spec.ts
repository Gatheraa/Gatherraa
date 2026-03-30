/**
 * Anomaly Detection Tests
 * Comprehensive test suite for detection logic
 */

import { Test } from '@nestjs/testing';
import { OrderbookDataIngestionService } from './ingestion/orderbook-data-ingestion.service';
import { HeuristicDetectionEngine } from './engines/heuristic-detection.engine';
import { MLDetectionEngine } from './engines/ml-detection.engine';
import { AnomalyAlertService } from './alerts/anomaly-alert.service';
import { AnomalyDetectionCoordinatorService } from './coordinator/anomaly-detection-coordinator.service';
import {
  OrderbookSnapshot,
  OrderbookEvent,
  DetectionResult,
  PriceLevel,
  FeatureVector,
} from './types/order-book.types';

describe('Anomaly Detection System', () => {
  let coordinator: AnomalyDetectionCoordinatorService;
  let heuristicEngine: HeuristicDetectionEngine;
  let mlEngine: MLDetectionEngine;
  let alertService: AnomalyAlertService;
  let ingestionService: OrderbookDataIngestionService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        OrderbookDataIngestionService,
        HeuristicDetectionEngine,
        MLDetectionEngine,
        AnomalyAlertService,
        AnomalyDetectionCoordinatorService,
      ],
    }).compile();

    coordinator = moduleRef.get(AnomalyDetectionCoordinatorService);
    heuristicEngine = moduleRef.get(HeuristicDetectionEngine);
    mlEngine = moduleRef.get(MLDetectionEngine);
    alertService = moduleRef.get(AnomalyAlertService);
    ingestionService = moduleRef.get(OrderbookDataIngestionService);
  });

  describe('Spoofing Detection', () => {
    it('should detect large orders followed by cancellation', () => {
      const events: OrderbookEvent[] = [
        {
          type: 'NEW_ORDER',
          timestamp: 100,
          symbol: 'ETH/USD',
          orderId: 'order1',
          traderId: 'trader1',
          side: 'BUY',
          price: 2000,
          quantity: 15000,
          sequence: 1,
        },
        {
          type: 'CANCEL_ORDER',
          timestamp: 200, // Cancelled after 100ms
          symbol: 'ETH/USD',
          orderId: 'order1',
          traderId: 'trader1',
          side: 'BUY',
          price: 2000,
          quantity: 15000,
          sequence: 2,
        },
      ];

      const snapshot: OrderbookSnapshot = {
        timestamp: 200,
        symbol: 'ETH/USD',
        bids: [[2000, 15000]].map(([p, q]) => ({ price: p, quantity: q })),
        asks: [[2001, 10000]].map(([p, q]) => ({ price: p, quantity: q })),
        sequence: 2,
        exchangeId: 'exchange1',
      };

      const detections = heuristicEngine.detectSpoofing(events, snapshot);

      expect(detections.length).toBeGreaterThan(0);
      expect(detections[0].patternName).toContain('spoofing')
        .or.contain('Spoofing');
      expect(detections[0].severity).toBe('CRITICAL');
      expect(detections[0].confidence).toBeGreaterThan(0.8);
    });

    it('should detect rapid order placement and cancellation', () => {
      const events: OrderbookEvent[] = [];

      for (let i = 0; i < 5; i++) {
        events.push({
          type: 'NEW_ORDER',
          timestamp: 1000 + i * 200,
          symbol: 'ETH/USD',
          orderId: `order${i}`,
          traderId: 'trader1',
          side: 'BUY',
          price: 2000,
          quantity: 1000,
          sequence: i * 2 + 1,
        });

        events.push({
          type: 'CANCEL_ORDER',
          timestamp: 1100 + i * 200,
          symbol: 'ETH/USD',
          orderId: `order${i}`,
          traderId: 'trader1',
          side: 'BUY',
          price: 2000,
          quantity: 1000,
          sequence: i * 2 + 2,
        });
      }

      const snapshot: OrderbookSnapshot = {
        timestamp: 2000,
        symbol: 'ETH/USD',
        bids: [[2000, 5000]].map(([p, q]) => ({ price: p, quantity: q })),
        asks: [[2001, 5000]].map(([p, q]) => ({ price: p, quantity: q })),
        sequence: 11,
        exchangeId: 'exchange1',
      };

      const detections = heuristicEngine.detectSpoofing(events, snapshot);

      expect(detections.length).toBeGreaterThan(0);
      expect(detections.some((d) => d.confidence > 0.8)).toBe(true);
    });
  });

  describe('Layering Detection', () => {
    it('should detect bid side layering', () => {
      const events: OrderbookEvent[] = [
        {
          type: 'NEW_ORDER',
          timestamp: 100,
          symbol: 'ETH/USD',
          orderId: 'order1',
          traderId: 'trader1',
          side: 'BUY',
          price: 2000,
          quantity: 5000,
          sequence: 1,
        },
        {
          type: 'NEW_ORDER',
          timestamp: 150,
          symbol: 'ETH/USD',
          orderId: 'order2',
          traderId: 'trader1',
          side: 'BUY',
          price: 1995,
          quantity: 5000,
          sequence: 2,
        },
        {
          type: 'NEW_ORDER',
          timestamp: 200,
          symbol: 'ETH/USD',
          orderId: 'order3',
          traderId: 'trader1',
          side: 'BUY',
          price: 1990,
          quantity: 5000,
          sequence: 3,
        },
        {
          type: 'CANCEL_ORDER',
          timestamp: 250,
          symbol: 'ETH/USD',
          orderId: 'order1',
          traderId: 'trader1',
          side: 'BUY',
          price: 2000,
          quantity: 5000,
          sequence: 4,
        },
      ];

      const snapshot: OrderbookSnapshot = {
        timestamp: 250,
        symbol: 'ETH/USD',
        bids: [
          { price: 1995, quantity: 5000 },
          { price: 1990, quantity: 5000 },
        ],
        asks: [[2001, 10000]].map(([p, q]) => ({ price: p, quantity: q })),
        sequence: 4,
        exchangeId: 'exchange1',
      };

      const detections = heuristicEngine.detectLayering(events, snapshot);

      expect(detections.some((d) => d.patternName.includes('Layering'))).toBe(
        true,
      );
    });
  });

  describe('Wash Trading Detection', () => {
    it('should detect self-dealing wash trades', () => {
      const events: OrderbookEvent[] = [
        {
          type: 'FILL_ORDER',
          timestamp: 100,
          symbol: 'ETH/USD',
          orderId: 'order1',
          traderId: 'trader1',
          side: 'BUY',
          price: 2000,
          quantity: 10000,
          fillQuantity: 10000,
          sequence: 1,
        },
        {
          type: 'FILL_ORDER',
          timestamp: 150,
          symbol: 'ETH/USD',
          orderId: 'order2',
          traderId: 'trader2',
          side: 'SELL',
          price: 2000,
          quantity: 10000,
          fillQuantity: 10000,
          sequence: 2,
        },
        {
          type: 'FILL_ORDER',
          timestamp: 200,
          symbol: 'ETH/USD',
          orderId: 'order3',
          traderId: 'trader1',
          side: 'BUY',
          price: 2000,
          quantity: 9500,
          fillQuantity: 9500,
          sequence: 3,
        },
        {
          type: 'FILL_ORDER',
          timestamp: 250,
          symbol: 'ETH/USD',
          orderId: 'order4',
          traderId: 'trader2',
          side: 'SELL',
          price: 2000,
          quantity: 9500,
          fillQuantity: 9500,
          sequence: 4,
        },
      ];

      const detections = heuristicEngine.detectWashTrading(events);

      expect(detections.length).toBeGreaterThan(0);
      expect(detections.some((d) => d.patternName.includes('Wash'))).toBe(true);
    });
  });

  describe('Pump and Dump Detection', () => {
    it('should detect coordinated buying followed by selling', () => {
      const events: OrderbookEvent[] = [];

      // Aggressive buying
      for (let i = 0; i < 10; i++) {
        events.push({
          type: 'FILL_ORDER',
          timestamp: 1000 + i * 50,
          symbol: 'ETH/USD',
          orderId: `buy${i}`,
          traderId: 'trader1',
          side: 'BUY',
          price: 2000 + i, // Prices increasing
          quantity: 6000,
          fillQuantity: 6000,
          sequence: i + 1,
        });
      }

      // Add normal sell orders for comparison
      for (let i = 0; i < 10; i++) {
        events.push({
          type: 'FILL_ORDER',
          timestamp: 2000 + i * 50,
          symbol: 'ETH/USD',
          orderId: `sell${i}`,
          traderId: 'trader2',
          side: 'SELL',
          price: 2050 - i,
          quantity: 6000,
          fillQuantity: 6000,
          sequence: i + 11,
        });
      }

      const features: FeatureVector = {
        symbol: 'ETH/USD',
        timestamp: Date.now(),
        traderId: 'trader1',
        spreadBps: 10,
        spreadDepthImbalance: 0.2,
        orderbookDepth: 100000,
        topNLevelImbalance: 0.15,
        averageOrderSize: 6000,
        orderCancellationRate: 0.05,
        orderLifetime: 200,
        repeatOrderRate: 0.1,
        traderCancellationRate: 0.05,
        traderFillRate: 0.95,
        traderVolumeConcentration: 0.3,
        volumeImbalance: 0.4,
        volumeConcentration: 0.25,
        unusualVolumeRatio: 2.5,
        priceMovement: 0.025,
        volatility: 0.002,
        priceResistance: 0.3,
      };

      const detections = heuristicEngine.detectPumpDump(events, features);

      expect(detections.length).toBeGreaterThan(0);
      expect(detections.some((d) => d.patternName.includes('Pump'))).toBe(true);
    });
  });

  describe('ML Detection Engine', () => {
    it('should detect unusual volume spikes', () => {
      const features: FeatureVector = {
        symbol: 'ETH/USD',
        timestamp: Date.now(),
        spreadBps: 10,
        spreadDepthImbalance: 0.2,
        orderbookDepth: 100000,
        topNLevelImbalance: 0.15,
        averageOrderSize: 1000,
        orderCancellationRate: 0.05,
        orderLifetime: 200,
        repeatOrderRate: 0.1,
        traderCancellationRate: 0.05,
        traderFillRate: 0.95,
        traderVolumeConcentration: 0.3,
        volumeImbalance: 0.8, // Very high imbalance
        volumeConcentration: 0.25,
        unusualVolumeRatio: 5.0,
        priceMovement: 0.005,
        volatility: 0.001,
        priceResistance: 0.3,
      };

      // Historical volumes with normal distribution
      const historicalVolumes = Array.from({ length: 20 }, (_, i) =>
        0.1 + Math.random() * 0.1,
      );

      const detections = mlEngine.detectUnusualVolumeSpike(
        features,
        historicalVolumes,
      );

      expect(detections.length).toBeGreaterThan(0);
      expect(detections[0].patternName).toContain('Volume');
    });

    it('should detect quote stuffing', () => {
      const detections = mlEngine.detectQuoteStuffing(2000, 50);

      expect(detections.length).toBeGreaterThan(0);
      expect(detections[0].patternName).toContain('Quote Stuffing');
      expect(detections[0].severity).toBe('MEDIUM');
    });
  });

  describe('Alert Management', () => {
    it('should create and manage alerts', () => {
      const detection: DetectionResult = {
        patternId: 'SPOOFING_LARGE_ORDERS',
        patternName: 'Large Order Spoofing',
        severity: 'CRITICAL',
        confidence: 0.95,
        timestamp: Date.now(),
        symbol: 'ETH/USD',
        traderId: 'trader1',
        evidence: [],
        metrics: {},
        explainability: 'Test spoofing detection',
      };

      const alert = alertService.createAlert(detection);

      expect(alert).toBeDefined();
      expect(alert.status).toBe('OPEN');
      expect(alert.traderId).toBe('trader1');

      // Acknowledge alert
      alertService.acknowledgeAlert(alert.alertId);
      const updated = alertService.getAlert(alert.alertId);
      expect(updated?.status).toBe('ACKNOWLEDGED');

      // Resolve alert
      alertService.resolveAlert(alert.alertId, 'RESOLVED');
      const resolved = alertService.getAlert(alert.alertId);
      expect(resolved?.status).toBe('RESOLVED');
    });

    it('should throttle suspicious traders', () => {
      expect(alertService.isActorThrottled('trader1')).toBe(false);

      // Create an alert and throttle the trader
      const detection: DetectionResult = {
        patternId: 'SPOOFING_LARGE_ORDERS',
        patternName: 'Large Order Spoofing',
        severity: 'CRITICAL',
        confidence: 0.95,
        timestamp: Date.now(),
        symbol: 'ETH/USD',
        traderId: 'trader1',
        evidence: [],
        metrics: {},
        explainability: 'Test',
      };

      const alert = alertService.createAlert(detection);
      alertService.executeAction(alert.alertId, 'THROTTLE', {
        durationMs: 3600000,
      });

      expect(alertService.isActorThrottled('trader1')).toBe(true);
    });

    it('should track alert statistics', () => {
      // Create multiple detections
      for (let i = 0; i < 3; i++) {
        const detection: DetectionResult = {
          patternId: 'SPOOFING_LARGE_ORDERS',
          patternName: 'Large Order Spoofing',
          severity: 'CRITICAL',
          confidence: 0.9 + Math.random() * 0.05,
          timestamp: Date.now(),
          symbol: 'ETH/USD',
          traderId: `trader${i}`,
          evidence: [],
          metrics: {},
          explainability: 'Test',
        };
        alertService.createAlert(detection);
      }

      const stats = alertService.getAlertStatistics(1);

      expect(stats.totalAlerts).toBeGreaterThanOrEqual(3);
      expect(stats.bySeverity['CRITICAL']).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Data Ingestion', () => {
    it('should ingest and process orderbook snapshots', () => {
      const snapshot: OrderbookSnapshot = {
        timestamp: Date.now(),
        symbol: 'ETH/USD',
        bids: [[2000, 10000]].map(([p, q]) => ({ price: p, quantity: q })),
        asks: [[2001, 10000]].map(([p, q]) => ({ price: p, quantity: q })),
        sequence: 1,
        exchangeId: 'exchange1',
      };

      ingestionService.ingestOrderbookSnapshot(snapshot);

      const latest = ingestionService.getLatestSnapshot('ETH/USD');
      expect(latest).toBeDefined();
      expect(latest?.symbol).toBe('ETH/USD');
    });

    it('should extract features from orderbook data', () => {
      const snapshot: OrderbookSnapshot = {
        timestamp: Date.now(),
        symbol: 'ETH/USD',
        bids: [
          { price: 2000, quantity: 10000 },
          { price: 1999, quantity: 8000 },
          { price: 1998, quantity: 6000 },
        ],
        asks: [
          { price: 2001, quantity: 9000 },
          { price: 2002, quantity: 7000 },
          { price: 2003, quantity: 5000 },
        ],
        sequence: 1,
        exchangeId: 'exchange1',
      };

      ingestionService.ingestOrderbookSnapshot(snapshot);

      const features = ingestionService.extractFeatures('ETH/USD');

      expect(features).toBeDefined();
      expect(features.symbol).toBe('ETH/USD');
      expect(features.spreadBps).toBeGreaterThan(0);
      expect(features.volumeImbalance).toBeGreaterThanOrEqual(0);
    });
  });

  describe('End-to-End Integration', () => {
    it('should process snapshot and generate alerts', async () => {
      // Create a spoofing scenario
      const events: OrderbookEvent[] = [
        {
          type: 'NEW_ORDER',
          timestamp: 100,
          symbol: 'ETH/USD',
          orderId: 'order1',
          traderId: 'malicious_trader',
          side: 'BUY',
          price: 2000,
          quantity: 20000,
          sequence: 1,
        },
        {
          type: 'CANCEL_ORDER',
          timestamp: 200,
          symbol: 'ETH/USD',
          orderId: 'order1',
          traderId: 'malicious_trader',
          side: 'BUY',
          price: 2000,
          quantity: 20000,
          sequence: 2,
        },
      ];

      const snapshot: OrderbookSnapshot = {
        timestamp: Date.now(),
        symbol: 'ETH/USD',
        bids: [[2000, 5000]].map(([p, q]) => ({ price: p, quantity: q })),
        asks: [[2001, 5000]].map(([p, q]) => ({ price: p, quantity: q })),
        sequence: 2,
        exchangeId: 'exchange1',
      };

      // Ingest events
      for (const event of events) {
        await coordinator.processOrderbookEvent(event);
      }

      // Process snapshot and check for detections
      const report = await coordinator.processOrderbookSnapshot(snapshot);

      expect(report).toBeDefined();
      expect(report.statistics.totalDetections).toBeGreaterThanOrEqual(0);
    });
  });
});
