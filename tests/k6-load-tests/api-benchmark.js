import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics for comprehensive tracking
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const requestsPerSecond = new Counter('requests_per_second');
const successfulTransactions = new Counter('successful_transactions');
const failedTransactions = new Counter('failed_transactions');

// Test configuration with multiple scenarios
export const options = {
  scenarios: {
    // Light load - baseline
    light_load: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 10 },
        { duration: '30s', target: 0 },
      ],
      gracefulStop: '30s',
    },
    
    // Standard load - typical usage
    standard_load: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '2m', target: 50 },
        { duration: '1m', target: 0 },
      ],
      gracefulStop: '30s',
      startTime: '2m',
    },
    
    // Heavy load - stress testing
    heavy_load: {
      executor: 'ramping-vus',
      startVUs: 50,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '3m', target: 100 },
        { duration: '1m', target: 0 },
      ],
      gracefulStop: '30s',
      startTime: '5m',
    },
  },
  
  thresholds: {
    http_req_duration: ['p(50)<100', 'p(95)<500', 'p(99)<1000'],
    errors: ['rate<0.01'],
    checks: ['rate>0.99'],
    response_time: ['avg<300', 'p(95)<500'],
  },
};

const BASE_URL = 'http://localhost:3000/api/v1';

// Helper functions for different scenarios
function createEvent() {
  const payload = JSON.stringify({
    title: `Performance Test Event ${__VU}_${Date.now()}`,
    description: 'Load testing event creation - comprehensive benchmark',
    type: 'conference',
    category: 'technology',
    startDate: new Date(Date.now() + 86400000).toISOString(),
    endDate: new Date(Date.now() + 172800000).toISOString(),
    location: 'Virtual Event Center',
    capacity: Math.floor(Math.random() * 1000) + 100,
    price: Math.floor(Math.random() * 500) + 50,
    currency: 'USD',
    tags: ['performance', 'testing', 'benchmark'],
  });

  const res = http.post(`${BASE_URL}/events`, payload, {
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer test_token_user_${__VU}`,
    },
  });

  return res;
}

function getEvents(page = 1, limit = 20) {
  return http.get(`${BASE_URL}/events?page=${page}&limit=${limit}`);
}

function searchEvents(query = 'conference') {
  return http.get(`${BASE_URL}/events/search?q=${query}&category=technology`);
}

function updateEvent(eventId) {
  const payload = JSON.stringify({
    title: `Updated Event ${eventId}`,
    description: 'Updated during performance test',
    capacity: 2000,
  });

  return http.put(`${BASE_URL}/events/${eventId}`, payload, {
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer test_token_user_${__VU}`,
    },
  });
}

function deleteEvent(eventId) {
  return http.del(`${BASE_URL}/events/${eventId}`, null, {
    headers: {
      'Authorization': `Bearer test_token_user_${__VU}`,
    },
  });
}

export default function() {
  const iterationStart = Date.now();
  
  try {
    // Scenario 1: Create Event (Write operation)
    const createRes = createEvent();
    const createSuccess = check(createRes, {
      'create event: status 201': (r) => r.status === 201,
      'create event: has ID': (r) => {
        try {
          return JSON.parse(r.body).id !== undefined;
        } catch (e) {
          return false;
        }
      },
      'create event: response time < 500ms': (r) => r.timings.duration < 500,
    });

    errorRate.add(!createSuccess);
    responseTime.add(createRes.timings.duration);
    
    if (createSuccess) {
      successfulTransactions.add(1);
      
      // Extract event ID for subsequent operations
      let eventId;
      try {
        eventId = JSON.parse(createRes.body).id;
      } catch (e) {
        eventId = null;
      }

      // Scenario 2: Get Events (Read operation - pagination)
      const getRes = getEvents(1, 20);
      const getSuccess = check(getRes, {
        'get events: status 200': (r) => r.status === 200,
        'get events: has data array': (r) => {
          try {
            return Array.isArray(JSON.parse(r.body).data);
          } catch (e) {
            return false;
          }
        },
        'get events: response time < 200ms': (r) => r.timings.duration < 200,
      });

      errorRate.add(!getSuccess);
      responseTime.add(getRes.timings.duration);

      // Scenario 3: Search Events (Complex query)
      const searchRes = searchEvents('conference');
      const searchSuccess = check(searchRes, {
        'search: status 200': (r) => r.status === 200,
        'search: response time < 300ms': (r) => r.timings.duration < 300,
      });

      errorRate.add(!searchSuccess);
      responseTime.add(searchRes.timings.duration);

      // Scenario 4: Update Event (if we have an ID)
      if (eventId) {
        sleep(0.5);
        const updateRes = updateEvent(eventId);
        const updateSuccess = check(updateRes, {
          'update event: status 200': (r) => r.status === 200,
          'update event: response time < 400ms': (r) => r.timings.duration < 400,
        });

        errorRate.add(!updateSuccess);
        responseTime.add(updateRes.timings.duration);

        // Scenario 5: Delete Event (cleanup)
        sleep(0.5);
        const deleteRes = deleteEvent(eventId);
        const deleteSuccess = check(deleteRes, {
          'delete event: status 200 or 204': (r) => r.status === 200 || r.status === 204,
          'delete event: response time < 300ms': (r) => r.timings.duration < 300,
        });

        errorRate.add(!deleteSuccess);
        responseTime.add(deleteRes.timings.duration);
      }
    } else {
      failedTransactions.add(1);
    }

  } catch (error) {
    errorRate.add(1);
    failedTransactions.add(1);
    console.error(`Iteration error: ${error.message}`);
  }

  requestsPerSecond.add(1);
  
  const elapsed = Date.now() - iterationStart;
  console.log(`Completed iteration in ${elapsed}ms`);
  
  sleep(2);
}

// Summary handler for report generation
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    test_type: 'api_benchmark',
    total_iterations: data.metrics.iterations?.values.count || 0,
    success_rate: ((data.metrics.iterations?.values.count - (data.metrics.failed_transactions?.values.count || 0)) / 
                   (data.metrics.iterations?.values.count || 1) * 100).toFixed(2),
    response_times: {
      avg: data.metrics.response_time?.values.avg?.toFixed(2) || '0',
      min: data.metrics.response_time?.values.min?.toFixed(2) || '0',
      max: data.metrics.response_time?.values.max?.toFixed(2) || '0',
      p50: data.metrics.response_time?.values['p(50)']?.toFixed(2) || '0',
      p95: data.metrics.response_time?.values['p(95)']?.toFixed(2) || '0',
      p99: data.metrics.response_time?.values['p(99)']?.toFixed(2) || '0',
    },
    error_rate: (data.metrics.errors?.values.rate || 0 * 100).toFixed(2),
    http_stats: {
      total_requests: data.metrics.http_reqs?.values.count || 0,
      req_per_sec: data.metrics.http_reqs?.values.rate?.toFixed(2) || '0',
      duration_p50: data.metrics.http_req_duration?.values['p(50)']?.toFixed(2) || '0',
      duration_p95: data.metrics.http_req_duration?.values['p(95)']?.toFixed(2) || '0',
      duration_p99: data.metrics.http_req_duration?.values['p(99)']?.toFixed(2) || '0',
    },
    thresholds: {
      passed: Object.entries(data.metrics).filter(([_, m]) => 
        m.thresholds && Object.values(m.thresholds).every(t => t.ok)
      ).length,
      failed: Object.entries(data.metrics).filter(([_, m]) => 
        m.thresholds && Object.values(m.thresholds).some(t => !t.ok)
      ).length,
    },
  };

  return {
    'reports/api-benchmark-summary.json': JSON.stringify(summary, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const { indent = '', enableColors = false } = options;
  const reset = enableColors ? '\x1b[0m' : '';
  const bold = enableColors ? '\x1b[1m' : '';
  
  let summary = `${bold}=== API Benchmark Results ===${reset}\n`;
  summary += `${indent}Timestamp: ${new Date().toISOString()}\n`;
  summary += `${indent}Total Iterations: ${data.metrics.iterations?.values.count || 0}\n`;
  summary += `${indent}Success Rate: ${summary.success_rate}%\n`;
  summary += `${bold}\nResponse Times:${reset}\n`;
  summary += `${indent}  Average: ${summary.response_times?.avg}ms\n`;
  summary += `${indent}  P95: ${summary.response_times?.p95}ms\n`;
  summary += `${indent}  P99: ${summary.response_times?.p99}ms\n`;
  summary += `${bold}\nHTTP Stats:${reset}\n`;
  summary += `${indent}  Total Requests: ${summary.http_stats?.total_requests}\n`;
  summary += `${indent}  Req/sec: ${summary.http_stats?.req_per_sec}\n`;
  summary += `${indent}  Error Rate: ${summary.error_rate}%\n`;
  
  return summary;
}
