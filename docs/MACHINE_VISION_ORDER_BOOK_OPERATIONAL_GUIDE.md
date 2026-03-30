# Machine Vision for Order Book Monitoring - Operational Guide

## Overview

This document provides operational guidance for the Anomaly Detection System for Order Book and Market Data Monitoring. The system detects trading manipulation including spoofing, layering, wash trading, and pump & dump schemes.

## System Architecture

### Components

1. **Data Ingestion Pipeline** (`orderbook-data-ingestion.service.ts`)
   - Collects orderbook snapshots, events, and market data
   - Normalizes data for analysis
   - Maintains trader profiles
   - Extracts feature vectors for ML analysis

2. **Detection Engines**
   - **Heuristic Engine** (`heuristic-detection.engine.ts`)
     - Rule-based pattern matching
     - Detects spoofing, layering, wash trading, pump & dump
   - **ML Engine** (`ml-detection.engine.ts`)
     - Statistical anomaly detection
     - Multi-dimensional feature analysis
     - Quote stuffing detection

3. **Alert Management** (`anomaly-alert.service.ts`)
   - Creates and tracks alerts
   - Manages alert lifecycle
   - Executes operator actions (throttle, block, ban)
   - Generates explainability logs

4. **Coordinator** (`anomaly-detection-coordinator.service.ts`)
   - Orchestrates detection engines
   - Manages configuration
   - Handles backtesting
   - Exports audit trails

## Detected Patterns

### Critical Severity (Auto-action: Ban)

#### 1. Spoofing - Large Order Spoofing
- **Pattern**: Large orders followed by cancellation before execution
- **Confidence Threshold**: 0.85
- **Evidence**:
  - Order size: >10,000 units
  - Cancellation time: <5 seconds after placement
- **Impact**: Creates false market impression, manipulates price

#### 2. Spoofing - Rapid Cancellation
- **Pattern**: Repeated rapid order placement/cancellation at same price
- **Confidence Threshold**: 0.80
- **Evidence**:
  - 3+ orders at same price
  - 2+ cancellations at same price
  - Average time between orders: <1 second

#### 3. Layering - Bid/Ask Side
- **Pattern**: Multiple orders at different price levels, cancelled when traded
- **Confidence Threshold**: 0.85
- **Evidence**:
  - 3+ price levels with orders
  - Top order cancelled shortly after placement
  - Appears designed to create depth illusion

### High Severity (Auto-action: Throttle 10 minutes)

#### 1. Wash Trading - Self-Dealing
- **Pattern**: Trades at same price with minimal spread, suggests related parties
- **Confidence Threshold**: 0.80
- **Evidence**:
  - Multiple trades at identical price
  - Buy and sell volumes within 10% of each other
  - Minimal price movement

#### 2. Pump & Dump - Coordinated
- **Pattern**: Coordinated buying followed by selling without fundamental catalyst
- **Confidence Threshold**: 0.80
- **Evidence**:
  - Large buy volume (>50,000 units)
  - Same trader aggressive selling
  - Price increase >2% followed by reversal

#### 3. Market Manipulation - Spoofing for Scalping
- **Pattern**: Large orders to move price, then cancelled for profit
- **Confidence Threshold**: 0.80
- **Evidence**:
  - Order size relative to orderbook depth
  - Price movement after order placement
  - Cancellation before execution

#### 4. Market Manipulation - Layering for Scalping
- **Pattern**: Layered orders to create depth, executed selectively
- **Confidence Threshold**: 0.80

#### 5. Market Manipulation - Reverse Spoofing
- **Pattern**: Orders opposite to intended direction to move price
- **Confidence Threshold**: 0.80

### Medium Severity (Manual Review)

#### 1. Wash Trading - Volume Pump
- **Pattern**: Artificial volume through repeated trades at same price
- **Confidence Threshold**: 0.75

#### 2. Pump & Dump - Momentum Manipulation
- **Pattern**: Aggressive trading followed by rapid reversal
- **Confidence Threshold**: 0.75

#### 3. Quote Stuffing
- **Pattern**: Rapid order placement/cancellation (>1000/sec, <100ms lifetime)
- **Confidence Threshold**: Variable

### Low Severity (Monitoring)

#### 1. Unusual Price Volatility
- **Pattern**: Abnormal price swings inconsistent with order depth
- **Confidence Threshold**: 0.70

#### 2. Unusual Volume Spike
- **Pattern**: Volume spike without corresponding price movement
- **Confidence Threshold**: 0.65

## API Reference

### Ingest Data

#### Orderbook Snapshot
```bash
POST /api/anomaly-detection/orderbook/snapshot
Content-Type: application/json

{
  "timestamp": 1234567890,
  "symbol": "ETH/USD",
  "bids": [
    { "price": 2000, "quantity": 10000 },
    { "price": 1999, "quantity": 8000 }
  ],
  "asks": [
    { "price": 2001, "quantity": 9000 },
    { "price": 2002, "quantity": 7000 }
  ],
  "sequence": 123,
  "exchangeId": "exchange1"
}
```

#### Orderbook Event
```bash
POST /api/anomaly-detection/orderbook/event
Content-Type: application/json

{
  "type": "NEW_ORDER|CANCEL_ORDER|FILL_ORDER|REPLACE_ORDER",
  "timestamp": 1234567890,
  "symbol": "ETH/USD",
  "orderId": "order123",
  "traderId": "trader1",
  "side": "BUY|SELL",
  "price": 2000,
  "quantity": 1000,
  "sequence": 123
}
```

#### Market Data
```bash
POST /api/anomaly-detection/market-data
Content-Type: application/json

{
  "timestamp": 1234567890,
  "symbol": "ETH/USD",
  "bestBid": 2000,
  "bestAsk": 2001,
  "spreadBps": 5,
  "volume24h": 1000000,
  "lastTrade": {
    "price": 2000.5,
    "quantity": 100,
    "timestamp": 1234567889,
    "side": "BUY",
    "aggressor": "trader1"
  },
  "vwap": 2000.3
}
```

### Alert Management

#### Get Open Alerts
```bash
GET /api/anomaly-detection/alerts/symbol/ETH/USD
```

#### Get Trader Alerts
```bash
GET /api/anomaly-detection/alerts/trader/trader1
```

#### Get Specific Alert
```bash
GET /api/anomaly-detection/alerts/{alertId}
```

#### Acknowledge Alert
```bash
PUT /api/anomaly-detection/alerts/{alertId}/acknowledge?acknowledgedBy=operator1
```

#### Set Investigating
```bash
PUT /api/anomaly-detection/alerts/{alertId}/investigating
```

#### Resolve Alert
```bash
PUT /api/anomaly-detection/alerts/{alertId}/resolve?as=RESOLVED|FALSE_POSITIVE
```

#### Execute Action
```bash
POST /api/anomaly-detection/alerts/{alertId}/action?type=THROTTLE|BLOCK|AUTO_BAN|REVIEW|ESCALATE
Content-Type: application/json

{
  "durationMs": 600000
}
```

### Configuration

#### Get Configuration
```bash
GET /api/anomaly-detection/config
```

#### Update Configuration
```bash
PUT /api/anomaly-detection/config
Content-Type: application/json

{
  "enabledPatterns": ["SPOOFING_LARGE_ORDERS", "LAYERING_BID_SIDE"],
  "alertThreshold": 0.70,
  "throttleThreshold": 0.80,
  "blockThreshold": 0.90,
  "mlEnabled": true,
  "heuristicsEnabled": true
}
```

### Analytics & Reporting

#### Get Statistics
```bash
GET /api/anomaly-detection/statistics?days=7
```

Response:
```json
{
  "totalAlerts": 42,
  "bySeverity": {
    "CRITICAL": 5,
    "HIGH": 12,
    "MEDIUM": 20,
    "LOW": 5
  },
  "byStatus": {
    "OPEN": 8,
    "ACKNOWLEDGED": 15,
    "INVESTIGATING": 5,
    "RESOLVED": 14,
    "FALSE_POSITIVE": 0
  },
  "byPattern": {
    "SPOOFING_LARGE_ORDERS": 8,
    "LAYERING_BID_SIDE": 6,
    "WASH_TRADING_SELF_DEALING": 12
  },
  "averageConfidence": 0.82,
  "uniqueTraders": 28
}
```

#### Export Alerts
```bash
GET /api/anomaly-detection/export?format=json|csv
```

#### Check Throttle Status
```bash
GET /api/anomaly-detection/throttle/{traderId}

# Response
{
  "isThrottled": true|false,
  "until": 1234567890,  // Optional
  "reason": "..."       // Optional
}
```

### Backtesting

#### Run Backtest
```bash
POST /api/anomaly-detection/backtest
Content-Type: application/json

{
  "symbol": "ETH/USD",
  "startTime": 1700000000000,
  "endTime": 1700086400000,
  "snapshots": [...],
  "events": [...]
}

# Response
{
  "totalSnapshots": 100,
  "totalDetections": 15,
  "detectionsByType": {
    "SPOOFING_LARGE_ORDERS": 5,
    "LAYERING_BID_SIDE": 3,
    "WASH_TRADING_SELF_DEALING": 7
  },
  "processingTimeMs": 250
}
```

## Configuration Guide

### Pattern Configuration

Enable/disable specific patterns:
```json
{
  "enabledPatterns": [
    "SPOOFING_LARGE_ORDERS",
    "SPOOFING_RAPID_CANCEL",
    "LAYERING_BID_SIDE",
    "LAYERING_ASK_SIDE",
    "WASH_TRADING_SELF_DEALING",
    "WASH_TRADING_VOLUME_PUMP",
    "PUMP_DUMP_COORDINATED",
    "PUMP_DUMP_MOMENTUM",
    "UNUSUAL_VOLUME_SPIKE",
    "UNUSUAL_PRICE_VOLATILITY"
  ]
}
```

### Threshold Configuration

```json
{
  "alertThreshold": 0.70,      // Minimum confidence for alert
  "throttleThreshold": 0.80,   // Auto-throttle if confidence exceeds
  "blockThreshold": 0.90,      // Auto-block if confidence exceeds
  "windowSize": 60000,         // Analysis window (ms)
  "lookbackPeriod": 3600000    // Historical data retention (ms)
}
```

### Detection Method Configuration

```json
{
  "heuristicsEnabled": true,   // Enable rule-based detection
  "mlEnabled": true,            // Enable ML-based detection
  "explainabilityLevel": "COMPREHENSIVE"  // BASIC | DETAILED | COMPREHENSIVE
}
```

## Operational Procedures

### Daily Operations

1. **Monitor Alert Dashboard**
   - Check open critical alerts every 15 minutes
   - Review new high-severity alerts hourly
   - Track alert resolution rate

2. **Review False Positives**
   - Investigate unresolved alerts older than 24 hours
   - Mark confirmed false positives
   - Adjust thresholds if needed

3. **Check System Health**
   - Verify data ingestion is working
   - Monitor detection engine performance
   - Check throttled actors list

### Investigation Workflow

1. **Alert Received**
   - System auto-generates alert with explainability logs
   - Check `explainability.summary` for quick understanding
   - Review `evidence` array for supporting indicators

2. **Manual Investigation**
   - Use `indicators` array to understand which factors triggered alert
   - Check `historicalContext` for similar past alerts
   - Review related patterns in `relatedPatterns`

3. **Take Action**
   - Mark as `INVESTIGATING` to indicate manual review started
   - Execute appropriate action:
     - THROTTLE: Limit order frequency (10 min default)
     - BLOCK: Suspend trading (1+ hours)
     - AUTO_BAN: Permanent suspension
     - REVIEW: Send to compliance team
     - ESCALATE: Send to higher authority

4. **Resolution**
   - Mark as `RESOLVED` if confirmed manipulation
   - Mark as `FALSE_POSITIVE` if benign activity
   - Document findings in system

### Handling False Positives

1. **Identify Patterns**
   - Analyze false positive alerts by pattern type
   - Check if specific symbols have higher false positive rates
   - Review time-of-day patterns

2. **Adjust Thresholds**
   ```bash
   PUT /api/anomaly-detection/config
   {
     "alertThreshold": 0.72,  // Increase from 0.70
     "throttleThreshold": 0.82  // Increase from 0.80
   }
   ```

3. **Update Rules**
   - Disable patterns with >20% false positive rate
   - Adjust feature weights in ML models
   - Add market condition qualifiers

## Monitoring & Dashboards

### Grafana Dashboard Queries

#### Alert Volume by Severity
```promql
increase(anomaly_alerts_total{severity=~"CRITICAL|HIGH"}[1h])
```

#### Detection Rate by Pattern
```promql
increase(anomaly_detections_total{pattern=~".*"}[1h])
```

#### Alert Resolution Time
```promql
histogram_quantile(0.95, alert_resolution_duration_seconds)
```

#### Throttled Traders
```promql
anomaly_throttled_traders_count
```

#### System Latency
```promql
histogram_quantile(0.99, detection_processing_duration_ms)
```

### Key Metrics to Track

1. **Detection Metrics**
   - Detections per hour by pattern
   - Detection engine latency (p50, p95, p99)
   - Feature extraction time

2. **Alert Metrics**
   - Alerts created per hour
   - Alert resolution time
   - False positive rate by pattern
   - Most common patterns

3. **Action Metrics**
   - Throttles executed
   - Blocks/bans executed
   - Action success rate
   - Throttled trader count

4. **System Health**
   - Data ingestion rate
   - Buffer utilization
   - Memory usage
   - Service availability

## Troubleshooting

### Low Detection Rate

**Symptoms**: Few or no alerts generated
**Causes**:
- Thresholds set too high
- Pattern disabled in configuration
- Insufficient historical data

**Solutions**:
1. Lower alert threshold
2. Enable additional patterns
3. Allow 1+ hour for historical data collection
4. Verify data ingestion is working

### High False Positive Rate

**Symptoms**: Many alerts on normal trading activity
**Causes**:
- Thresholds set too low
- ML model not trained on market conditions
- Patterns not suitable for current market

**Solutions**:
1. Increase thresholds gradually
2. Disable problematic patterns
3. Review false positive alerts to find patterns
4. Adjust feature weights

### Performance Issues

**Symptoms**: Detection latency >1 second or 100% CPU
**Causes**:
- Too many patterns enabled
- ML analysis disabled helps
- Buffer not flushing
- Feature extraction overhead

**Solutions**:
1. Disable less critical patterns
2. Increase window size
3. Monitor buffer stats
4. Consider disabling ML engine

### Missing Trades in Orderbook

**Symptoms**: Anomalies not detected despite suspicious activity
**Causes**:
- Events not ingested
- Different trader IDs used
- Orders not matched to fills

**Solutions**:
1. Verify event ingestion endpoint
2. Check trader ID mapping
3. Review event sequence numbers
4. Check for lost network packets

## Performance Optimization

### Production Tuning

1. **Batch Ingestion**
   - Use `/orderbook/snapshot-batch` endpoint
   - Send 50-100 snapshots per request
   - Reduces network overhead

2. **Pattern Prioritization**
   - Enable only critical patterns in production
   - Use separate dev environment for testing
   - Monitor least-detected patterns

3. **Historical Data Management**
   - Set appropriate `lookbackPeriod`
   - Archive old alert data
   - Compress feature history

4. **ML Model Updates**
   - Retrain models weekly
   - Use rolling window approach
   - A/B test new thresholds

## Integration Examples

### Real-time Data Feed Integration

```typescript
import { AnomalyDetectionCoordinatorService } from '@app/anomaly-detection';

export class OrderbookStreamHandler {
  constructor(private anomalyDetection: AnomalyDetectionCoordinatorService) {}

  async handleSnapshot(snapshot: OrderbookSnapshot) {
    const report = await this.anomalyDetection.processOrderbookSnapshot(snapshot);
    
    if (report.statistics.criticalCount > 0) {
      await this.alertSlackChannel(report);
    }
  }

  async handleEvent(event: OrderbookEvent) {
    await this.anomalyDetection.processOrderbookEvent(event);
  }
}
```

### Alert Handler Integration

```typescript
export class AlertHandler {
  async onAlertCreated(alert: AnomalyAlert) {
    if (alert.severity === 'CRITICAL') {
      // Immediate action
      await this.alertService.executeAction(alert.alertId, 'AUTO_BAN');
      await this.notifyComplianceTeam(alert);
    } else if (alert.severity === 'HIGH') {
      // Throttle and review
      await this.alertService.executeAction(alert.alertId, 'THROTTLE');
      await this.queueForReview(alert);
    }
  }
}
```

## Compliance & Legal

### Audit Trail

- All alerts are logged with full explainability
- Action history is maintained indefinitely
- Export functionality supports SOX/regulatory requirements
- Trader action timelines are preserved

### Data Retention

- Alert data: 3 years minimum
- Feature data: 1 year minimum
- Throttle/block records: 5 years minimum
- Audit trail: 7 years minimum

### Regulatory Compliance

- System detects patterns defined in:
  - SEC Rule 10b-5 (spoofing)
  - Dodd-Frank Act Section 747 (layering)
  - Exchange Rule 10.15 (wash trades)
  - CFTC regulations (market manipulation)

## Support & Escalation

For issues, escalation, or feature requests:

1. Check troubleshooting guide
2. Review system logs and metrics
3. Export diagnostic data
4. Contact trading operations team
5. Escalate to compliance if pattern issues detected

---

**Version**: 1.0  
**Last Updated**: 2024  
**Maintainer**: Trading Surveillance Team
