import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics for edge case testing
export const edgeCaseErrors = new Rate('edge_case_errors');
export const timeoutErrors = new Rate('timeout_errors');
export const authErrors = new Rate('auth_errors');

// Test configuration for edge cases
export const options = {
  stages: [
    { duration: '10s', target: 5 },   // Warm up with low load
    { duration: '30s', target: 50 },  // Normal load
    { duration: '20s', target: 100 }, // High load
    { duration: '15s', target: 200 }, // Stress load
    { duration: '10s', target: 0 },   // Cool down
  ],
  thresholds: {
    http_req_failed: ['rate<0.15'], // Allow higher failure rate for edge cases
    http_req_duration: ['p(95)<2000'], // More lenient duration for edge cases
    edge_case_errors: ['rate<0.05'],
    timeoutErrors: ['rate<0.02'],
    authErrors: ['rate<0.01'],
  },
};

const BASE_URL = 'http://localhost:3000';

// ============================================================================
// MINIMUM/MAXIMUM VALUE TESTS
// ============================================================================

export function testMinimumValues() {
  // Test with minimum valid amounts
  const minPayload = JSON.stringify({
    userId: '550e8400-e29b-41d4-a716-446655440000',
    amount: 0.01, // Minimum amount
    currency: 'USD',
    type: 'ticket_purchase',
    description: 'Minimum Value Test'
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
    },
    timeout: '10s',
  };

  const res = http.post(`${BASE_URL}/payments/stripe/initiate`, minPayload, params);
  
  const success = check(res, {
    'minimum value status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'minimum value response time < 2s': (r) => r.timings.duration < 2000,
  });

  if (!success) {
    edgeCaseErrors.add(1);
  }

  sleep(1);
}

export function testMaximumValues() {
  // Test with maximum valid amounts
  const maxPayload = JSON.stringify({
    userId: '550e8400-e29b-41d4-a716-446655440000',
    amount: 999999.99, // Maximum amount
    currency: 'USD',
    type: 'ticket_purchase',
    description: 'Maximum Value Test - ' + 'x'.repeat(1000) // Long description
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
    },
    timeout: '30s', // Longer timeout for large payload
  };

  const res = http.post(`${BASE_URL}/payments/stripe/initiate`, maxPayload, params);
  
  const success = check(res, {
    'maximum value status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'maximum value response time < 5s': (r) => r.timings.duration < 5000,
  });

  if (!success) {
    edgeCaseErrors.add(1);
  }

  sleep(2);
}

// ============================================================================
// ZERO VALUE TESTS
// ============================================================================

export function testZeroAmount() {
  // Test with zero amount
  const zeroPayload = JSON.stringify({
    userId: '550e8400-e29b-41d4-a716-446655440000',
    amount: 0.00, // Zero amount
    currency: 'USD',
    type: 'ticket_purchase',
    description: 'Zero Amount Test'
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
    },
  };

  const res = http.post(`${BASE_URL}/payments/stripe/initiate`, zeroPayload, params);
  
  const success = check(res, {
    'zero amount handled gracefully': (r) => r.status === 400 || r.status === 422, // Should reject zero
    'zero amount response time < 1s': (r) => r.timings.duration < 1000,
  });

  if (!success) {
    edgeCaseErrors.add(1);
  }

  sleep(0.5);
}

export function testEmptyFields() {
  // Test with empty fields
  const emptyPayload = JSON.stringify({
    userId: '', // Empty user ID
    amount: 50.00,
    currency: '', // Empty currency
    type: '', // Empty type
    description: '' // Empty description
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
    },
  };

  const res = http.post(`${BASE_URL}/payments/stripe/initiate`, emptyPayload, params);
  
  const success = check(res, {
    'empty fields rejected properly': (r) => r.status === 400 || r.status === 422,
    'empty fields response time < 1s': (r) => r.timings.duration < 1000,
  });

  if (!success) {
    edgeCaseErrors.add(1);
  }

  sleep(0.5);
}

// ============================================================================
// EMPTY COLLECTION TESTS
// ============================================================================

export function testEmptyCart() {
  // Test with empty cart/items
  const emptyCartPayload = JSON.stringify({
    userId: '550e8400-e29b-41d4-a716-446655440000',
    amount: 0.00,
    currency: 'USD',
    type: 'ticket_purchase',
    description: 'Empty Cart Test',
    items: [] // Empty items array
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
    },
  };

  const res = http.post(`${BASE_URL}/payments/stripe/initiate`, emptyCartPayload, params);
  
  const success = check(res, {
    'empty cart handled gracefully': (r) => r.status === 400 || r.status === 422,
    'empty cart response time < 1s': (r) => r.timings.duration < 1000,
  });

  if (!success) {
    edgeCaseErrors.add(1);
  }

  sleep(0.5);
}

export function testLargeCollection() {
  // Test with very large collection
  const items = [];
  for (let i = 0; i < 1000; i++) {
    items.push({
      id: `item-${i}`,
      name: `Item ${i}`,
      price: 10.00,
      quantity: 1
    });
  }

  const largeCollectionPayload = JSON.stringify({
    userId: '550e8400-e29b-41d4-a716-446655440000',
    amount: 10000.00,
    currency: 'USD',
    type: 'bulk_purchase',
    description: 'Large Collection Test',
    items: items
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
    },
    timeout: '60s', // Long timeout for large payload
  };

  const res = http.post(`${BASE_URL}/payments/stripe/initiate`, largeCollectionPayload, params);
  
  const success = check(res, {
    'large collection handled': (r) => r.status === 200 || r.status === 201 || r.status === 413, // 413 = Too Large
    'large collection response time < 10s': (r) => r.timings.duration < 10000,
  });

  if (!success) {
    edgeCaseErrors.add(1);
  }

  sleep(3);
}

// ============================================================================
// ERROR CONDITION TESTS
// ============================================================================

export function testInvalidAuthentication() {
  // Test with invalid authentication
  const invalidAuthPayload = JSON.stringify({
    userId: '550e8400-e29b-41d4-a716-446655440000',
    amount: 50.00,
    currency: 'USD',
    type: 'ticket_purchase',
    description: 'Invalid Auth Test'
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer invalid-token-12345', // Invalid token
    },
  };

  const res = http.post(`${BASE_URL}/payments/stripe/initiate`, invalidAuthPayload, params);
  
  const success = check(res, {
    'invalid auth rejected': (r) => r.status === 401 || r.status === 403,
    'invalid auth response time < 1s': (r) => r.timings.duration < 1000,
  });

  if (!success) {
    authErrors.add(1);
  }

  sleep(0.5);
}

export function testMissingAuthentication() {
  // Test with missing authentication
  const noAuthPayload = JSON.stringify({
    userId: '550e8400-e29b-41d4-a716-446655440000',
    amount: 50.00,
    currency: 'USD',
    type: 'ticket_purchase',
    description: 'No Auth Test'
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      // No Authorization header
    },
  };

  const res = http.post(`${BASE_URL}/payments/stripe/initiate`, noAuthPayload, params);
  
  const success = check(res, {
    'missing auth rejected': (r) => r.status === 401 || r.status === 403,
    'missing auth response time < 1s': (r) => r.timings.duration < 1000,
  });

  if (!success) {
    authErrors.add(1);
  }

  sleep(0.5);
}

export function testInvalidDataTypes() {
  // Test with invalid data types
  const invalidTypesPayload = JSON.stringify({
    userId: 123456, // Should be string
    amount: "fifty", // Should be number
    currency: null, // Should be string
    type: undefined, // Should be string
    description: { nested: 'object' } // Should be string
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
    },
  };

  const res = http.post(`${BASE_URL}/payments/stripe/initiate`, invalidTypesPayload, params);
  
  const success = check(res, {
    'invalid types rejected': (r) => r.status === 400 || r.status === 422,
    'invalid types response time < 1s': (r) => r.timings.duration < 1000,
  });

  if (!success) {
    edgeCaseErrors.add(1);
  }

  sleep(0.5);
}

export function testMalformedJSON() {
  // Test with malformed JSON
  const malformedPayload = `{
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "amount": 50.00,
    "currency": "USD",
    "type": "ticket_purchase",
    "description": "Malformed JSON Test",
  }`; // Missing closing brace

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
    },
  };

  const res = http.post(`${BASE_URL}/payments/stripe/initiate`, malformedPayload, params);
  
  const success = check(res, {
    'malformed JSON rejected': (r) => r.status === 400,
    'malformed JSON response time < 1s': (r) => r.timings.duration < 1000,
  });

  if (!success) {
    edgeCaseErrors.add(1);
  }

  sleep(0.5);
}

export function testTimeoutConditions() {
  // Test timeout conditions with very slow endpoint
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
    },
    timeout: '100ms', // Very short timeout
  };

  const res = http.get(`${BASE_URL}/payments/slow-endpoint`, params);
  
  const success = check(res, {
    'timeout handled gracefully': (r) => r.status === 0 || r.status === 408, // 0 = timeout, 408 = request timeout
  });

  if (!success) {
    timeoutErrors.add(1);
  }

  sleep(0.1);
}

export function testConcurrentRequests() {
  // Test concurrent requests to same resource
  const payload = JSON.stringify({
    userId: '550e8400-e29b-41d4-a716-446655440000',
    amount: 50.00,
    currency: 'USD',
    type: 'ticket_purchase',
    description: 'Concurrent Request Test'
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
    },
  };

  // Make multiple concurrent requests
  const requests = [];
  for (let i = 0; i < 10; i++) {
    requests.push(http.asyncRequest('POST', `${BASE_URL}/payments/stripe/initiate`, payload, params));
  }

  // Wait for all requests to complete
  const responses = Promise.all(requests);
  
  // Check that most requests succeeded
  let successCount = 0;
  for (const res of responses) {
    if (res.status === 200 || res.status === 201) {
      successCount++;
    }
  }

  const success = check(null, {
    'concurrent requests mostly successful': () => successCount >= 8, // At least 80% success
  });

  if (!success) {
    edgeCaseErrors.add(1);
  }

  sleep(1);
}

// ============================================================================
// MAIN TEST FUNCTION - RANDOMIZED EDGE CASES
// ============================================================================

export default function () {
  // Array of edge case test functions
  const edgeCaseTests = [
    testMinimumValues,
    testMaximumValues,
    testZeroAmount,
    testEmptyFields,
    testEmptyCart,
    testLargeCollection,
    testInvalidAuthentication,
    testMissingAuthentication,
    testInvalidDataTypes,
    testMalformedJSON,
    testTimeoutConditions,
    testConcurrentRequests,
  ];

  // Randomly select an edge case test to run
  const randomTest = edgeCaseTests[Math.floor(Math.random() * edgeCaseTests.length)];
  randomTest();

  // Also run a basic health check
  const healthRes = http.get(`${BASE_URL}/payments/health/check`);
  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
  });
}

// ============================================================================
// STRESS TEST FOR EDGE CASES
// ============================================================================

export function handleSummary(data) {
  return {
    'edge_case_tests_passed': `${data.metrics.edge_case_errors ? (100 - data.metrics.edge_case_errors.rate * 100) : 100}%`,
    'timeout_errors': `${data.metrics.timeoutErrors ? data.metrics.timeoutErrors.rate * 100 : 0}%`,
    'auth_errors': `${data.metrics.authErrors ? data.metrics.authErrors.rate * 100 : 0}%`,
    'http_req_failed': `${data.metrics.http_req_failed.rate * 100}%`,
    'avg_request_duration': `${data.metrics.http_req_duration.avg}ms`,
    'p95_request_duration': `${data.metrics.http_req_duration['p(95)']}ms`,
  };
}
