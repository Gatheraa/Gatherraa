import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// High load metrics
const systemOverload = new Rate('system_overload');
const timeoutRate = new Rate('timeout_rate');
const circuitBreaker = new Counter('circuit_breaker_trips');
const queueDepth = new Trend('queue_depth_estimate');

export const options = {
  scenarios: {
    // Spike test - sudden massive traffic increase
    spike: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 500,
      stages: [
        { duration: '30s', target: 20 },    // Normal load
        { duration: '10s', target: 200 },   // Sudden spike (10x)
        { duration: '1m', target: 200 },    // Hold spike
        { duration: '30s', target: 20 },    // Recovery
      ],
    },
    
    // Breakpoint test - find absolute limits
    breakpoint: {
      executor: 'ramping-arrival-rate',
      startRate: 50,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 1000,
      stages: [
        { duration: '1m', target: 100 },
        { duration: '1m', target: 300 },
        { duration: '1m', target: 500 },
        { duration: '1m', target: 700 },
        { duration: '1m', target: 1000 },
      ],
      startTime: '3m',
    },
  },
  
  thresholds: {
    http_req_duration: ['p(95)<5000', 'p(99)<10000'], // More lenient for extreme load
    http_req_failed: ['rate<0.10'], // Allow up to 10% failure under extreme load
    system_overload: ['rate<0.20'], // System should handle 80% of load
    timeout_rate: ['rate<0.15'],
  },
};

const BASE_URL = 'http://localhost:3000/api/v1';

// Simulate different user behaviors under load
const userBehaviors = [
  { name: 'browse_events', weight: 0.4, action: browseEvents },
  { name: 'create_event', weight: 0.1, action: createEvent },
  { name: 'purchase_ticket', weight: 0.3, action: purchaseTicket },
  { name: 'search', weight: 0.2, action: searchEvents },
];

function browseEvents() {
  const page = Math.floor(Math.random() * 10) + 1;
  const limit = Math.floor(Math.random() * 3) * 20 + 20; // 20, 40, or 60
  
  const res = http.get(`${BASE_URL}/events?page=${page}&limit=${limit}`, {
    headers: { 'Authorization': `Bearer test_token_user_${__VU}` },
    timeout: '5s',
  });
  
  return res;
}

function createEvent() {
  const payload = JSON.stringify({
    title: `High Load Event ${Date.now()}_${Math.random()}`,
    type: 'meetup',
    capacity: Math.floor(Math.random() * 500) + 50,
    startDate: new Date(Date.now() + 86400000).toISOString(),
  });
  
  const res = http.post(`${BASE_URL}/events`, payload, {
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer test_token_user_${__VU}`,
    },
    timeout: '5s',
  });
  
  return res;
}

function purchaseTicket() {
  const eventId = Math.floor(Math.random() * 1000);
  const quantity = Math.floor(Math.random() * 5) + 1;
  
  const payload = JSON.stringify({
    eventId: eventId,
    quantity: quantity,
    paymentMethod: 'stripe',
  });
  
  const res = http.post(`${BASE_URL}/tickets/purchase`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer test_token_user_${__VU}`,
    },
    timeout: '10s', // Longer timeout for payment
  });
  
  return res;
}

function searchEvents() {
  const queries = ['conference', 'meetup', 'workshop', 'seminar', ''];
  const query = queries[Math.floor(Math.random() * queries.length)];
  
  const res = http.get(`${BASE_URL}/events/search?q=${query}`, {
    headers: { 'Authorization': `Bearer test_token_user_${__VU}` },
    timeout: '5s',
  });
  
  return res;
}

export default function() {
  const iterationStart = Date.now();
  
  try {
    // Select behavior based on weights
    const rand = Math.random();
    let cumulativeWeight = 0;
    let selectedBehavior = userBehaviors[0];
    
    for (const behavior of userBehaviors) {
      cumulativeWeight += behavior.weight;
      if (rand <= cumulativeWeight) {
        selectedBehavior = behavior;
        break;
      }
    }
    
    // Execute the selected behavior
    const res = selectedBehavior.action();
    
    // Check for overload conditions
    const isTimeout = res.status === 0 || res.timings.duration > 5000;
    const isServerError = res.status >= 500;
    const isOverloaded = isTimeout || isServerError;
    
    timeoutRate.add(isTimeout ? 1 : 0);
    systemOverload.add(isOverloaded ? 1 : 0);
    
    // Check for circuit breaker (503 Service Unavailable)
    if (res.status === 503) {
      circuitBreaker.add(1);
      console.log(`Circuit breaker tripped at iteration ${__ITER}`);
    }
    
    // Estimate queue depth based on response times
    if (res.timings.duration > 1000) {
      // Assuming longer response times indicate queuing
      const estimatedQueue = Math.floor(res.timings.duration / 100);
      queueDepth.add(estimatedQueue);
    }
    
    // Validate response
    const success = check(res, {
      'request completed': (r) => r.status !== 0,
      'no server error': (r) => r.status < 500,
      'response time < 5s': (r) => r.timings.duration < 5000,
    });
    
    if (!success) {
      console.warn(`Request failed: ${selectedBehavior.name}, status: ${res.status}, duration: ${res.timings.duration}ms`);
    }
    
  } catch (error) {
    systemOverload.add(1);
    console.error(`High load error: ${error.message}`);
  }
  
  const elapsed = Date.now() - iterationStart;
  
  // Log warnings for extreme conditions
  if (elapsed > 10000) {
    console.warn(`Slow iteration: ${elapsed}ms at VU=${__VU}, iter=${__ITER}`);
  }
  
  sleep(0.5); // Minimal sleep to maximize load
}

// Summary with high-load specific analysis
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    test_type: 'high_load_spike_breakpoint',
    load_characteristics: {
      max_vus: data.metrics.vus?.values.max || 0,
      avg_vus: data.metrics.vus?.values.avg?.toFixed(0) || '0',
      total_iterations: data.metrics.iterations?.values.count || 0,
    },
    system_health: {
      overload_rate: ((data.metrics.system_overload?.values.rate || 0) * 100).toFixed(2),
      timeout_rate: ((data.metrics.timeout_rate?.values.rate || 0) * 100).toFixed(2),
      circuit_breaker_trips: data.metrics.circuit_breaker?.values.count || 0,
      error_rate: ((data.metrics.http_req_failed?.values.rate || 0) * 100).toFixed(2),
    },
    performance_under_load: {
      p95_duration: data.metrics.http_req_duration?.values['p(95)']?.toFixed(0) || '0',
      p99_duration: data.metrics.http_req_duration?.values['p(99)']?.toFixed(0) || '0',
      max_duration: data.metrics.http_req_duration?.values.max?.toFixed(0) || '0',
      avg_queue_depth: data.metrics.queue_depth_estimate?.values.avg?.toFixed(0) || '0',
    },
    breaking_point: {
      // Estimate when error rate exceeded 20%
      reached_max_load: data.metrics.system_overload?.values.rate < 0.2,
      requests_handled: data.metrics.http_reqs?.values.count || 0,
      requests_failed: data.metrics.http_req_failed?.values.count || 0,
    },
    recommendations: generateRecommendations(data),
  };

  return {
    'reports/high-load-summary.json': JSON.stringify(summary, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function generateRecommendations(data) {
  const recs = [];
  
  const errorRate = data.metrics.http_req_failed?.values.rate || 0;
  const timeoutRate = data.metrics.timeout_rate?.values.rate || 0;
  const p99Duration = data.metrics.http_req_duration?.values['p(99)'] || 0;
  
  if (errorRate > 0.1) {
    recs.push('❌ High error rate - consider adding more server capacity or optimizing database queries');
  }
  
  if (timeoutRate > 0.15) {
    recs.push('❌ High timeout rate - review connection pool settings and increase timeouts');
  }
  
  if (p99Duration > 5000) {
    recs.push('❌ P99 latency too high - investigate slow queries and add caching');
  }
  
  if (data.metrics.circuit_breaker?.values.count > 0) {
    recs.push('⚠️ Circuit breaker activated - system is protecting itself from overload');
  }
  
  if (recs.length === 0) {
    recs.push('✅ System handled high load well. Consider this as new baseline.');
  }
  
  return recs;
}

function textSummary(data, options) {
  const { indent = '', enableColors = false } = options;
  const reset = enableColors ? '\x1b[0m' : '';
  const bold = enableColors ? '\x1b[1m' : '';
  const green = enableColors ? '\x1b[32m' : '';
  const red = enableColors ? '\x1b[31m' : '';
  const yellow = enableColors ? '\x1b[33m' : '';
  
  const errorRate = (data.metrics.http_req_failed?.values.rate || 0) * 100;
  const overloadRate = (data.metrics.system_overload?.values.rate || 0) * 100;
  
  let summary = `${bold}=== High Load Test Results ===${reset}\n`;
  summary += `${indent}Timestamp: ${new Date().toISOString()}\n`;
  summary += `${bold}\nLoad:${reset}\n`;
  summary += `${indent}  Max VUs: ${data.metrics.vus?.values.max || 0}\n`;
  summary += `${indent}  Total Requests: ${data.metrics.http_reqs?.values.count || 0}\n`;
  summary += `${bold}\nSystem Health:${reset}\n`;
  summary += `${indent}  Error Rate: ${errorRate > 10 ? red : green}${errorRate.toFixed(2)}%${reset}\n`;
  summary += `${indent}  Timeout Rate: ${overloadRate > 15 ? red : green}${overloadRate.toFixed(2)}%${reset}\n`;
  summary += `${indent}  Circuit Breaker Trips: ${yellow}${data.metrics.circuit_breaker?.values.count || 0}${reset}\n`;
  summary += `${bold}\nPerformance:${reset}\n`;
  summary += `${indent}  P95 Duration: ${data.metrics.http_req_duration?.values['p(95)']?.toFixed(0) || '0'}ms\n`;
  summary += `${indent}  P99 Duration: ${data.metrics.http_req_duration?.values['p(99)']?.toFixed(0) || '0'}ms\n`;
  summary += `${bold}\nStatus: ${reset}${errorRate > 10 ? red + '⚠️ SYSTEM UNDER HEAVY LOAD' + reset : green + '✅ HANDLED LOAD WELL' + reset}\n`;
  
  return summary;
}
