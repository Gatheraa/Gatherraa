import { Injectable } from '@nestjs/common';

export interface MetricCounter {
  name: string;
  help: string;
  type: 'counter' | 'gauge';
  values: Map<string, number>;
}

@Injectable()
export class RateLimitMetricsService {
  private readonly hitsCounter = new Map<string, number>();
  private readonly violationsCounter = new Map<string, number>();
  private readonly remainingGauge = new Map<string, number>();

  /** Increment total rate limit checks */
  recordHit(endpoint: string, tier: string, allowed: boolean): void {
    const key = `endpoint="${endpoint}",tier="${tier}",allowed="${allowed}"`;
    const current = this.hitsCounter.get(key) || 0;
    this.hitsCounter.set(key, current + 1);
  }

  /** Increment total rate limit violations (429) */
  recordViolation(endpoint: string, tier: string, strategy: string): void {
    const key = `endpoint="${endpoint}",tier="${tier}",strategy="${strategy}"`;
    const current = this.violationsCounter.get(key) || 0;
    this.violationsCounter.set(key, current + 1);
  }

  /** Update remaining quota gauge */
  setRemaining(endpoint: string, ip: string, remaining: number): void {
    const key = `endpoint="${endpoint}",ip="${ip}"`;
    this.remainingGauge.set(key, remaining);
  }

  /** Expose Prometheus metrics format (text/plain; version=0.0.4) */
  getMetricsAsPrometheusText(): string {
    const lines: string[] = [];

    // rate_limit_hits_total
    lines.push('# HELP rate_limit_hits_total Total number of rate limit evaluations.');
    lines.push('# TYPE rate_limit_hits_total counter');
    if (this.hitsCounter.size === 0) {
      lines.push('rate_limit_hits_total 0');
    } else {
      for (const [labels, val] of this.hitsCounter.entries()) {
        lines.push(`rate_limit_hits_total{${labels}} ${val}`);
      }
    }

    lines.push('');

    // rate_limit_violations_total
    lines.push('# HELP rate_limit_violations_total Total number of rate limit violations (HTTP 429).');
    lines.push('# TYPE rate_limit_violations_total counter');
    if (this.violationsCounter.size === 0) {
      lines.push('rate_limit_violations_total 0');
    } else {
      for (const [labels, val] of this.violationsCounter.entries()) {
        lines.push(`rate_limit_violations_total{${labels}} ${val}`);
      }
    }

    lines.push('');

    // rate_limit_remaining
    lines.push('# HELP rate_limit_remaining Remaining requests quota for endpoint/IP.');
    lines.push('# TYPE rate_limit_remaining gauge');
    if (this.remainingGauge.size === 0) {
      lines.push('rate_limit_remaining 0');
    } else {
      for (const [labels, val] of this.remainingGauge.entries()) {
        lines.push(`rate_limit_remaining{${labels}} ${val}`);
      }
    }

    return lines.join('\n') + '\n';
  }

  reset(): void {
    this.hitsCounter.clear();
    this.violationsCounter.clear();
    this.remainingGauge.clear();
  }
}
