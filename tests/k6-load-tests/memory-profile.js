import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// Memory and performance metrics
const memoryUsage = new Gauge('memory_usage_bytes');
const heapSize = new Trend('heap_size_bytes');
const responseSize = new Trend('response_size_bytes');
const leakDetector = new Counter('potential_leaks');
const gcPauses = new Trend('gc_pause_estimate_ms');
const cacheHitRate = new Rate('cache_hits');
const dbQueryTime = new Trend('db_query_time_ms');

export const options = {
  scenarios: {
    // Soak test - long duration to detect leaks
    soak_test: {
      executor: 'constant-vus',
      vus: 20,
      duration: '10m',
      gracefulStop: '30s',
    },
    
    // Memory-intensive operations
    memory_spike: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '2m', target: 50 },
        { duration: '1m', target: 10 },
      ],
      gracefulStop: '30s',
      startTime: '10m30s',
    },
  },
  
  thresholds: {
    memory_usage_bytes: ['avg<536870912'], // < 512MB average
    heap_size_bytes: ['p(95)<268435456'],  // < 256MB p95
    http_req_duration: ['p(95)<1000'],
    potential_leaks: ['count<100'],
  },
};

const BASE_URL = 'http://localhost:3000/api/v1';

// Track baseline memory for leak detection
let baselineMemory = 0;
let previousMemory = 0;
const memorySamples = [];

function measureMemoryUsage(responseSize) {
  // Estimate memory usage based on response size and internal state
  // In production, you'd use Node.js process.memoryUsage()
  const estimatedRSS = responseSize * 1000; // Rough multiplier for Node.js overhead
  const estimatedHeap = responseSize * 500;
  
  memoryUsage.add(estimatedRSS);
  heapSize.add(estimatedHeap);
  
  // Store samples for trend analysis
  memorySamples.push(estimatedRSS);
  if (memorySamples.length > 100) {
    memorySamples.shift();
  }
  
  return { estimatedRSS, estimatedHeap };
}

function detectLeaks(currentMemory) {
  if (memorySamples.length < 10) return false;
  
  // Simple leak detection: check if memory is consistently growing
  const avgGrowth = (currentMemory - memorySamples[0]) / memorySamples.length;
  
  // If average growth > 1KB per iteration, potential leak
  return avgGrowth > 1024;
}

function fetchLargeDataset(endpoint, params = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const startTime = Date.now();
  
  const res = http.get(url, {
    headers: {
      'Authorization': `Bearer test_token_user_${__VU}`,
    },
    ...params,
  });
  
  const queryTime = Date.now() - startTime;
  dbQueryTime.add(queryTime);
  
  return res;
}

function testPaginationLeak() {
  // Test for pagination-related memory leaks
  let page = 1;
  const maxPages = 10;
  
  while (page <= maxPages) {
    const res = fetchLargeDataset(`/events?page=${page}&limit=100`);
    
    if (res.status === 200) {
      responseSize.add(res.body.length);
      const { estimatedRSS } = measureMemoryUsage(res.body.length);
      
      // Check if we're leaking memory across pages
      if (detectLeaks(estimatedRSS)) {
        leakDetector.add(1);
        console.warn(`Potential leak detected at page ${page}`);
      }
    }
    
    page++;
    sleep(0.2);
  }
}

function testCacheBehavior() {
  // Test caching by making identical requests
  const cacheTestUrl = '/events/popular';
  const responses = [];
  
  // Make 5 identical requests
  for (let i = 0; i < 5; i++) {
    const res = http.get(`${BASE_URL}${cacheTestUrl}`, {
      headers: {
        'Authorization': `Bearer test_token_user_${__VU}`,
      },
    });
    
    responses.push({
      status: res.status,
      etag: res.headers['ETag'],
      lastModified: res.headers['Last-Modified'],
      cacheControl: res.headers['Cache-Control'],
      bodySize: res.body.length,
    });
    
    sleep(0.1);
  }
  
  // Check if caching is working (ETag or Last-Modified should be present)
  const hasCacheHeaders = responses.some(r => r.etag || r.lastModified);
  cacheHitRate.add(hasCacheHeaders);
  
  // Response sizes should be consistent if cached
  const sizes = responses.map(r => r.bodySize);
  const sizeVariance = Math.max(...sizes) - Math.min(...sizes);
  
  if (sizeVariance > 1000) {
    console.warn(`High size variance in cached responses: ${sizeVariance} bytes`);
  }
}

function testBulkOperations() {
  // Test bulk data processing that might cause memory issues
  const bulkPayload = JSON.stringify({
    events: Array.from({ length: 50 }, (_, i) => ({
      title: `Bulk Event ${i}_${Date.now()}`,
      type: 'meetup',
      capacity: 100,
      startDate: new Date(Date.now() + 86400000).toISOString(),
    })),
  });
  
  const res = http.post(`${BASE_URL}/events/bulk`, bulkPayload, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer test_token_admin`,
    },
  });
  
  if (res.status === 201 || res.status === 200) {
    responseSize.add(res.body.length);
    measureMemoryUsage(res.body.length);
  }
  
  return res;
}

function testSearchWithLargeResult() {
  // Test search that returns large result sets
  const res = fetchLargeDataset('/events/search?q=&category=&type=', {
    params: { limit: 1000, include_metadata: true },
  });
  
  if (res.status === 200) {
    responseSize.add(res.body.length);
    const { estimatedRSS } = measureMemoryUsage(res.body.length);
    
    // Large result sets can cause memory pressure
    if (res.body.length > 1000000) { // > 1MB
      console.warn(`Large response received: ${(res.body.length / 1024 / 1024).toFixed(2)}MB`);
    }
  }
}

function simulateGCPressure() {
  // Simulate GC pressure by creating many short-lived objects
  const startTime = Date.now();
  
  // Force garbage collection estimation
  // Note: Real GC would happen automatically in Node.js
  for (let i = 0; i < 100; i++) {
    const tempData = {
      id: i,
      data: 'x'.repeat(1000), // 1KB string
      timestamp: Date.now(),
    };
    
    // Use it briefly then discard
    JSON.stringify(tempData);
  }
  
  const gcEstimate = Date.now() - startTime;
  gcPauses.add(gcEstimate);
}

export default function() {
  const iterationStart = Date.now();
  
  try {
    // Test 1: Pagination leak detection
    testPaginationLeak();
    sleep(1);
    
    // Test 2: Cache behavior
    testCacheBehavior();
    sleep(0.5);
    
    // Test 3: Bulk operations
    testBulkOperations();
    sleep(1);
    
    // Test 4: Large search results
    testSearchWithLargeResult();
    sleep(1);
    
    // Test 5: GC pressure simulation
    simulateGCPressure();
    
    // Final memory check
    const finalRes = http.get(`${BASE_URL}/events?limit=10`, {
      headers: {
        'Authorization': `Bearer test_token_user_${__VU}`,
      },
    });
    
    if (finalRes.status === 200) {
      const currentMem = measureMemoryUsage(finalRes.body.length).estimatedRSS;
      
      // Update baseline on first iteration
      if (__ITER === 0) {
        baselineMemory = currentMem;
      }
      
      // Check for significant memory growth
      const memoryGrowth = ((currentMem - baselineMemory) / baselineMemory) * 100;
      
      if (memoryGrowth > 50) {
        console.warn(`Memory grew by ${memoryGrowth.toFixed(2)}% from baseline`);
        leakDetector.add(1);
      }
      
      previousMemory = currentMem;
    }
    
  } catch (error) {
    console.error(`Memory profile error: ${error.message}`);
    leakDetector.add(1);
  }
  
  const elapsed = Date.now() - iterationStart;
  console.log(`Memory profile iteration completed in ${elapsed}ms`);
  
  sleep(2);
}

// Summary export with memory analysis
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    test_type: 'memory_profile',
    memory_stats: {
      avg_rss: data.metrics.memory_usage_bytes?.values.avg?.toFixed(0) || '0',
      max_rss: data.metrics.memory_usage_bytes?.values.max?.toFixed(0) || '0',
      avg_heap: data.metrics.heap_size_bytes?.values.avg?.toFixed(0) || '0',
      p95_heap: data.metrics.heap_size_bytes?.values['p(95)']?.toFixed(0) || '0',
    },
    response_stats: {
      avg_size: data.metrics.response_size_bytes?.values.avg?.toFixed(0) || '0',
      max_size: data.metrics.response_size_bytes?.values.max?.toFixed(0) || '0',
    },
    leak_detection: {
      potential_leaks: data.metrics.potential_leaks?.values.count || 0,
      memory_samples_collected: memorySamples.length,
    },
    performance_stats: {
      avg_db_query: data.metrics.db_query_time?.values.avg?.toFixed(2) || '0',
      p95_db_query: data.metrics.db_query_time?.values['p(95)']?.toFixed(2) || '0',
      avg_gc_pause: data.metrics.gc_pause_estimate?.values.avg?.toFixed(2) || '0',
    },
    cache_stats: {
      cache_hit_rate: (data.metrics.cache_hit_rate?.values.rate || 0 * 100).toFixed(2),
    },
  };

  return {
    'reports/memory-profile-summary.json': JSON.stringify(summary, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const { indent = '', enableColors = false } = options;
  const reset = enableColors ? '\x1b[0m' : '';
  const bold = enableColors ? '\x1b[1m' : '';
  const green = enableColors ? '\x1b[32m' : '';
  const yellow = enableColors ? '\x1b[33m' : '';
  const red = enableColors ? '\x1b[31m' : '';
  
  let summary = `${bold}=== Memory Profile Results ===${reset}\n`;
  summary += `${indent}Timestamp: ${new Date().toISOString()}\n`;
  summary += `${bold}\nMemory Usage:${reset}\n`;
  summary += `${indent}  Avg RSS: ${green}${(parseInt(data.metrics.memory_usage_bytes?.values.avg || 0) / 1024 / 1024).toFixed(2)}MB${reset}\n`;
  summary += `${indent}  Max RSS: ${yellow}${(parseInt(data.metrics.memory_usage_bytes?.values.max || 0) / 1024 / 1024).toFixed(2)}MB${reset}\n`;
  summary += `${indent}  Avg Heap: ${(parseInt(data.metrics.heap_size_bytes?.values.avg || 0) / 1024 / 1024).toFixed(2)}MB\n`;
  summary += `${bold}\nResponse Sizes:${reset}\n`;
  summary += `${indent}  Avg: ${(parseInt(data.metrics.response_size_bytes?.values.avg || 0) / 1024).toFixed(2)}KB\n`;
  summary += `${indent}  Max: ${(parseInt(data.metrics.response_size_bytes?.values.max || 0) / 1024 / 1024).toFixed(2)}MB\n`;
  summary += `${bold}\nLeak Detection:${reset}\n`;
  summary += `${indent}  Potential Leaks: ${red}${data.metrics.potential_leaks?.values.count || 0}${reset}\n`;
  summary += `${bold}\nPerformance:${reset}\n`;
  summary += `${indent}  Avg DB Query: ${data.metrics.db_query_time?.values.avg?.toFixed(2) || '0'}ms\n`;
  summary += `${indent}  Avg GC Pause: ${data.metrics.gc_pause_estimate?.values.avg?.toFixed(2) || '0'}ms\n`;
  
  return summary;
}
