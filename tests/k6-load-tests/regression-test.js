import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// Regression-specific metrics
const baselineComparison = new Trend('baseline_comparison');
const regressionDetected = new Rate('regression_detected');

// Load baseline thresholds from environment or use defaults
const BASELINE_P50 = Number(__ENV.BASELINE_P50 || 100);
const BASELINE_P95 = Number(__ENV.BASELINE_P95 || 500);
const BASELINE_P99 = Number(__ENV.BASELINE_P99 || 1000);
const BASELINE_RPS = Number(__ENV.BASELINE_RPS || 100); // Requests per second
const BASELINE_ERROR_RATE = Number(__ENV.BASELINE_ERROR_RATE || 0.01); // 1%

export const options = {
  scenarios: {
    // Quick regression check - suitable for CI/CD
    regression_check: {
      executor: 'constant-vus',
      vus: 20,
      duration: '5m',
      gracefulStop: '30s',
    },
    
    // Extended regression test - more thorough
    extended_regression: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '1m', target: 30 },
        { duration: '3m', target: 30 },
        { duration: '1m', target: 10 },
      ],
      gracefulStop: '30s',
      startTime: '5m30s',
    },
  },
  
  thresholds: {
    http_req_duration: [
      `p(50)<${BASELINE_P50 * 1.2}`,  // Allow 20% degradation
      `p(95)<${BASELINE_P95 * 1.2}`,
      `p(99)<${BASELINE_P99 * 1.2}`,
    ],
    http_req_failed: [`rate<${BASELINE_ERROR_RATE * 2}`],
    baseline_comparison: ['avg<1'], // Should be close to 1 (current/baseline)
  },
};

const BASE_URL = 'http://localhost:3000/api/v1';

// Critical user journeys for regression testing
const criticalPaths = [
  {
    name: 'create_event',
    method: 'POST',
    path: '/events',
    weight: 0.3, // 30% of traffic
    payload: () => JSON.stringify({
      title: `Regression Test Event ${Date.now()}`,
      type: 'conference',
      capacity: 100,
      startDate: new Date(Date.now() + 86400000).toISOString(),
    }),
  },
  {
    name: 'get_events',
    method: 'GET',
    path: '/events?page=1&limit=20',
    weight: 0.4, // 40% of traffic
  },
  {
    name: 'search_events',
    method: 'GET',
    path: '/events/search?q=conference',
    weight: 0.2,
  },
  {
    name: 'initiate_payment',
    method: 'POST',
    path: '/payments/stripe/initiate',
    weight: 0.1,
    payload: () => JSON.stringify({
      userId: `user_${Math.random().toString(36).substr(2, 9)}`,
      amount: 50,
      currency: 'USD',
      type: 'ticket_purchase',
    }),
  },
];

function executeCriticalPath(pathConfig) {
  const url = `${BASE_URL}${pathConfig.path}`;
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer test_token_user_${__VU}`,
    },
  };

  let res;
  const startTime = Date.now();

  if (pathConfig.method === 'POST' && pathConfig.payload) {
    res = http.post(url, pathConfig.payload(), params);
  } else if (pathConfig.method === 'GET') {
    res = http.get(url, params);
  }

  const duration = Date.now() - startTime;

  // Compare with baseline
  const ratio = duration / BASELINE_P95;
  baselineComparison.add(ratio);

  // Check for regression
  const isRegression = duration > BASELINE_P95 * 1.5; // 50% worse than baseline
  regressionDetected.add(isRegression ? 1 : 0);

  return { res, duration, isRegression };
}

export default function() {
  const iterationStart = Date.now();
  let regressions = 0;
  let totalChecks = 0;

  try {
    // Execute each critical path based on its weight
    for (const path of criticalPaths) {
      // Randomly decide whether to execute this path based on weight
      if (Math.random() < path.weight) {
        const { res, duration, isRegression } = executeCriticalPath(path);

      const checkName = path.name;
      const success = check(res, {
        [`${checkName}: status OK`]: (r) => r.status >= 200 && r.status < 300,
        [`${checkName}: response time acceptable`]: (r) => r.timings.duration < BASELINE_P99,
        [`${checkName}: no regression`]: () => !isRegression,
      });

        if (isRegression) {
          regressions++;
          console.warn(`⚠️ REGRESSION DETECTED: ${path.name} took ${duration}ms (baseline P95: ${BASELINE_P95}ms)`);
        }

        totalChecks++;
        sleep(0.5);
      }
    }

    // Additional comprehensive checks every few iterations
    if (__ITER % 5 === 0) {
      runComprehensiveCheck();
    }

  } catch (error) {
    console.error(`Regression test error: ${error.message}`);
    regressionDetected.add(1);
  }

  const elapsed = Date.now() - iterationStart;
  
  // Log summary at end of iteration
  if (totalChecks > 0) {
    const regressionRate = (regressions / totalChecks) * 100;
    console.log(`Iteration completed in ${elapsed}ms | Regressions: ${regressions}/${totalChecks} (${regressionRate.toFixed(1)}%)`);
  }
  
  sleep(1);
}

function runComprehensiveCheck() {
  // Run a more comprehensive check periodically
  console.log('Running comprehensive regression check...');
  
  // Test pagination at different page sizes
  const pageSizes = [10, 50, 100, 500];
  for (const size of pageSizes) {
    const res = http.get(`${BASE_URL}/events?page=1&limit=${size}`, {
      headers: { 'Authorization': `Bearer test_token_user_1` },
    });
    
    const expectedMaxTime = BASELINE_P95 * (1 + size / 100); // Allow some increase with size
    if (res.timings.duration > expectedMaxTime) {
      console.warn(`Pagination regression: limit=${size} took ${res.timings.duration}ms (expected < ${expectedMaxTime}ms)`);
      regressionDetected.add(1);
    }
  }
  
  // Test concurrent requests
  const concurrentCount = 5;
  const startTime = Date.now();
  for (let i = 0; i < concurrentCount; i++) {
    http.get(`${BASE_URL}/events/popular`, {
      headers: { 'Authorization': `Bearer test_token_user_${i}` },
    });
  }
  const concurrentDuration = Date.now() - startTime;
  
  if (concurrentDuration > BASELINE_P95 * concurrentCount * 0.5) {
    console.warn(`Concurrency regression: ${concurrentCount} parallel requests took ${concurrentDuration}ms`);
    regressionDetected.add(1);
  }
}

// Summary export with detailed regression analysis
export function handleSummary(data) {
  const currentP50 = data.metrics.http_req_duration?.values['p(50)'] || 0;
  const currentP95 = data.metrics.http_req_duration?.values['p(95)'] || 0;
  const currentP99 = data.metrics.http_req_duration?.values['p(99)'] || 0;
  const currentErrorRate = data.metrics.http_req_failed?.values.rate || 0;
  
  const summary = {
    timestamp: new Date().toISOString(),
    test_type: 'performance_regression',
    baseline_thresholds: {
      p50: BASELINE_P50,
      p95: BASELINE_P95,
      p99: BASELINE_P99,
      rps: BASELINE_RPS,
      error_rate: BASELINE_ERROR_RATE,
    },
    current_performance: {
      p50: currentP50.toFixed(2),
      p95: currentP95.toFixed(2),
      p99: currentP99.toFixed(2),
      error_rate: (currentErrorRate * 100).toFixed(2),
    },
    regression_analysis: {
      p50_degradation: ((currentP50 - BASELINE_P50) / BASELINE_P50 * 100).toFixed(2),
      p95_degradation: ((currentP95 - BASELINE_P95) / BASELINE_P95 * 100).toFixed(2),
      p99_degradation: ((currentP99 - BASELINE_P99) / BASELINE_P99 * 100).toFixed(2),
      regression_detected: currentP95 > BASELINE_P95 * 1.2 || currentP99 > BASELINE_P99 * 1.2,
    },
    threshold_status: {
      passed: Object.entries(data.metrics).filter(([_, m]) => 
        m.thresholds && Object.values(m.thresholds).every(t => t.ok)
      ).length,
      failed: Object.entries(data.metrics).filter(([_, m]) => 
        m.thresholds && Object.values(m.thresholds).some(t => !t.ok)
      ).length,
    },
    recommendation: generateRecommendation(currentP50, currentP95, currentP99, currentErrorRate),
  };

  return {
    'reports/regression-results.json': JSON.stringify(summary, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function generateRecommendation(p50, p95, p99, errorRate) {
  const issues = [];
  
  if (p95 > BASELINE_P95 * 1.5) {
    issues.push('Significant P95 degradation detected - investigate recent changes');
  }
  
  if (p99 > BASELINE_P99 * 1.5) {
    issues.push('P99 tail latency increased - check for resource contention');
  }
  
  if (errorRate > BASELINE_ERROR_RATE * 2) {
    issues.push('Error rate elevated - review error logs and recent deployments');
  }
  
  if (issues.length === 0) {
    return '✅ Performance within acceptable range. No action required.';
  }
  
  return `⚠️ Issues detected:\n   - ${issues.join('\n   - ')}`;
}

function textSummary(data, options) {
  const { indent = '', enableColors = false } = options;
  const reset = enableColors ? '\x1b[0m' : '';
  const bold = enableColors ? '\x1b[1m' : '';
  const green = enableColors ? '\x1b[32m' : '';
  const red = enableColors ? '\x1b[31m' : '';
  const yellow = enableColors ? '\x1b[33m' : '';
  
  const currentP95 = data.metrics.http_req_duration?.values['p(95)'] || 0;
  const currentP99 = data.metrics.http_req_duration?.values['p(99)'] || 0;
  const hasRegression = currentP95 > BASELINE_P95 * 1.2 || currentP99 > BASELINE_P99 * 1.2;
  
  let summary = `${bold}=== Performance Regression Test ===${reset}\n`;
  summary += `${indent}Timestamp: ${new Date().toISOString()}\n`;
  summary += `${bold}\nBaseline vs Current:${reset}\n`;
  summary += `${indent}  P50: ${yellow}${BASELINE_P50}ms${reset} → ${hasRegression ? red : green}${currentP95.toFixed(0)}ms${reset}\n`;
  summary += `${indent}  P95: ${yellow}${BASELINE_P95}ms${reset} → ${hasRegression ? red : green}${currentP95.toFixed(0)}ms${reset}\n`;
  summary += `${indent}  P99: ${yellow}${BASELINE_P99}ms${reset} → ${hasRegression ? red : green}${currentP99.toFixed(0)}ms${reset}\n`;
  summary += `${bold}\nDegradation:${reset}\n`;
  summary += `${indent}  P95: ${((currentP95 - BASELINE_P95) / BASELINE_P95 * 100).toFixed(1)}%\n`;
  summary += `${indent}  P99: ${((currentP99 - BASELINE_P99) / BASELINE_P99 * 100).toFixed(1)}%\n`;
  summary += `${bold}\nStatus: ${reset}${hasRegression ? red + '❌ REGRESSION DETECTED' + reset : green + '✅ NO REGRESSION' + reset}\n`;
  
  return summary;
}
