/**
 * Grafana Dashboard for Anomaly Detection
 * JSON configuration for Grafana dashboard
 */

export const AnomalyDetectionDashboard = {
  "dashboard": {
    "title": "Order Book Anomaly Detection",
    "description": "Real-time monitoring of spoofing, layering, and other market manipulation",
    "tags": ["trading", "anomaly-detection", "compliance"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Alert Volume (Last 24h)",
        "type": "graph",
        "gridPos": { "x": 0, "y": 0, "w": 8, "h": 8 },
        "targets": [
          {
            "expr": "increase(anomaly_alerts_total[24h])",
            "legendFormat": "Total Alerts"
          },
          {
            "expr": "increase(anomaly_alerts_total{severity='CRITICAL'}[24h])",
            "legendFormat": "Critical Alerts"
          },
          {
            "expr": "increase(anomaly_alerts_total{severity='HIGH'}[24h])",
            "legendFormat": "High Alerts"
          }
        ]
      },
      {
        "id": 2,
        "title": "Alert Status Breakdown",
        "type": "piechart",
        "gridPos": { "x": 8, "y": 0, "w": 8, "h": 8 },
        "targets": [
          {
            "expr": "anomaly_alerts_by_status",
            "format": "heatmap"
          }
        ]
      },
      {
        "id": 3,
        "title": "Detection Rate by Pattern",
        "type": "bargauge",
        "gridPos": { "x": 0, "y": 8, "w": 12, "h": 8 },
        "targets": [
          {
            "expr": "increase(anomaly_detections_total{pattern=~'.*'}[1h])",
            "format": "heatmap",
            "legendFormat": "{{pattern}}"
          }
        ]
      },
      {
        "id": 4,
        "title": "Top Traders (by alerts)",
        "type": "table",
        "gridPos": { "x": 12, "y": 8, "w": 12, "h": 8 },
        "targets": [
          {
            "expr": "topk(10, anomaly_alerts_total{trader_id!=''})",
            "format": "table"
          }
        ]
      },
      {
        "id": 5,
        "title": "Detection Latency (ms)",
        "type": "graph",
        "gridPos": { "x": 0, "y": 16, "w": 8, "h": 8 },
        "targets": [
          {
            "expr": "histogram_quantile(0.50, detection_latency_ms)",
            "legendFormat": "p50"
          },
          {
            "expr": "histogram_quantile(0.95, detection_latency_ms)",
            "legendFormat": "p95"
          },
          {
            "expr": "histogram_quantile(0.99, detection_latency_ms)",
            "legendFormat": "p99"
          }
        ]
      },
      {
        "id": 6,
        "title": "Throttled Traders",
        "type": "stat",
        "gridPos": { "x": 8, "y": 16, "w": 4, "h": 8 },
        "targets": [
          {
            "expr": "anomaly_throttled_traders_count"
          }
        ]
      },
      {
        "id": 7,
        "title": "False Positive Rate",
        "type": "stat",
        "gridPos": { "x": 12, "y": 16, "w": 4, "h": 8 },
        "targets": [
          {
            "expr": "(increase(anomaly_alerts_resolved_as_false_positive[7d]) / increase(anomaly_alerts_total[7d])) * 100"
          }
        ]
      },
      {
        "id": 8,
        "title": "Alert Resolution Time",
        "type": "graph",
        "gridPos": { "x": 16, "y": 16, "w": 8, "h": 8 },
        "targets": [
          {
            "expr": "histogram_quantile(0.50, alert_resolution_duration_seconds)",
            "legendFormat": "p50"
          },
          {
            "expr": "histogram_quantile(0.95, alert_resolution_duration_seconds)",
            "legendFormat": "p95"
          }
        ]
      },
      {
        "id": 9,
        "title": "Recent Critical Alerts",
        "type": "table",
        "gridPos": { "x": 0, "y": 24, "w": 24, "h": 8 },
        "targets": [
          {
            "expr": "anomaly_recent_alerts{severity='CRITICAL'}",
            "format": "table",
            "instant": true
          }
        ]
      },
      {
        "id": 10,
        "title": "Market Symbols Monitored",
        "type": "stat",
        "gridPos": { "x": 0, "y": 32, "w": 6, "h": 6 },
        "targets": [
          {
            "expr": "count(anomaly_alerts_total)"
          }
        ]
      },
      {
        "id": 11,
        "title": "Service Health",
        "type": "stat",
        "gridPos": { "x": 6, "y": 32, "w": 6, "h": 6 },
        "targets": [
          {
            "expr": "up{job='anomaly-detection'}"
          }
        ],
        "thresholds": {
          "mode": "absolute",
          "steps": [
            { "color": "red", "value": 0 },
            { "color": "yellow", "value": 0.5 },
            { "color": "green", "value": 1 }
          ]
        }
      },
      {
        "id": 12,
        "title": "Alert Confidence Distribution",
        "type": "histogram",
        "gridPos": { "x": 12, "y": 32, "w": 12, "h": 6 },
        "targets": [
          {
            "expr": "anomaly_alert_confidence_bucket"
          }
        ]
      }
    ],
    "refresh": "30s",
    "templating": {
      "list": [
        {
          "name": "symbol",
          "type": "query",
          "datasource": "Prometheus",
          "query": "label_values(anomaly_alerts_total, symbol)"
        },
        {
          "name": "severity",
          "type": "custom",
          "options": ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
        },
        {
          "name": "pattern",
          "type": "query",
          "datasource": "Prometheus",
          "query": "label_values(anomaly_detections_total, pattern)"
        }
      ]
    }
  }
};
