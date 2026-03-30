import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// Custom metrics for payment-specific tracking
const paymentSuccessRate = new Rate('payment_success_rate');
const paymentDuration = new Trend('payment_duration');
const stripePaymentRate = new Rate('stripe_payments');
const cryptoPaymentRate = new Rate('crypto_payments');
const paymentErrors = new Counter('payment_errors');
const refundSuccessRate = new Rate('refund_success_rate');
const highValuePayments = new Counter('high_value_payments'); // > $500
const lowValuePayments = new Counter('low_value_payments');  // < $50

// Memory tracking (simulated via response sizes)
const memoryUsage = new Gauge('estimated_memory_bytes');

export const options = {
  scenarios: {
    // Normal payment load
    normal_load: {
      executor: 'constant-arrival-rate',
      rate: 10, // 10 iterations per second
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 20,
      maxVUs: 50,
    },
    
    // Spike load - sudden traffic increase
    spike_test: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { duration: '30s', target: 20 },   // Normal
        { duration: '30s', target: 100 },  // Ramp to spike
        { duration: '1m', target: 100 },   // Hold spike
        { duration: '30s', target: 20 },   // Recovery
      ],
      startTime: '2m30s',
    },
    
    // Breakpoint test - find system limits
    breakpoint_test: {
      executor: 'ramping-arrival-rate',
      startRate: 50,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 500,
      stages: [
        { duration: '1m', target: 100 },
        { duration: '1m', target: 200 },
        { duration: '1m', target: 300 },
        { duration: '1m', target: 400 },
        { duration: '1m', target: 500 },
      ],
      startTime: '5m',
    },
  },
  
  thresholds: {
    payment_success_rate: ['rate>0.95'],
    payment_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_duration: ['p(95)<1000'],
    payment_errors: ['count<50'],
  },
};

const BASE_URL = 'http://localhost:3000/api/v1/payments';

// Generate random payment data
function generatePaymentData() {
  const paymentTypes = ['stripe', 'crypto', 'paypal'];
  const currencies = ['USD', 'EUR', 'GBP', 'CAD'];
  const type = paymentTypes[Math.floor(Math.random() * paymentTypes.length)];
  const currency = currencies[Math.floor(Math.random() * currencies.length)];
  
  // Generate amount with some high-value and low-value payments
  let amount;
  const rand = Math.random();
  if (rand < 0.2) {
    amount = Math.floor(Math.random() * 50) + 10; // Low value: $10-$60
    lowValuePayments.add(1);
  } else if (rand > 0.8) {
    amount = Math.floor(Math.random() * 500) + 500; // High value: $500-$1000
    highValuePayments.add(1);
  } else {
    amount = Math.floor(Math.random() * 450) + 50; // Normal: $50-$500
  }
  
  return {
    userId: `user_${Math.random().toString(36).substr(2, 9)}`,
    eventId: `event_${Math.floor(Math.random() * 1000)}`,
    amount: amount,
    currency: currency,
    type: type,
    description: `Performance test payment - ${type}`,
    metadata: {
      test_run: true,
      timestamp: Date.now(),
      vu: __VU,
      iteration: __ITER,
    },
  };
}

function initiateStripePayment(paymentData) {
  const payload = JSON.stringify({
    ...paymentData,
    paymentMethod: 'card',
    cardDetails: {
      number: '4242424242424242', // Test card
      expMonth: '12',
      expYear: '2025',
      cvc: '123',
    },
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer test_token_${paymentData.userId}`,
      'Idempotency-Key': `stripe_${Date.now()}_${Math.random()}`,
    },
  };

  const startTime = Date.now();
  const res = http.post(`${BASE_URL}/stripe/initiate`, payload, params);
  const duration = Date.now() - startTime;

  return { res, duration, type: 'stripe' };
}

function initiateCryptoPayment(paymentData) {
  const payload = JSON.stringify({
    ...paymentData,
    cryptocurrency: 'USDC',
    walletAddress: `0x${Math.random().toString(16).substr(2, 40)}`,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer test_token_${paymentData.userId}`,
    },
  };

  const startTime = Date.now();
  const res = http.post(`${BASE_URL}/crypto/initiate`, payload, params);
  const duration = Date.now() - startTime;

  return { res, duration, type: 'crypto' };
}

function confirmPayment(transactionId) {
  const payload = JSON.stringify({
    transactionId: transactionId,
    status: 'completed',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer test_token_admin`,
    },
  };

  const res = http.post(`${BASE_URL}/confirm`, payload, params);
  return res;
}

function processRefund(transactionId, amount) {
  const payload = JSON.stringify({
    transactionId: transactionId,
    amount: amount,
    reason: 'performance_test',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer test_token_admin`,
    },
  };

  const startTime = Date.now();
  const res = http.post(`${BASE_URL}/refund`, payload, params);
  const duration = Date.now() - startTime;

  return { res, duration };
}

export default function() {
  const iterationStart = Date.now();
  
  try {
    // Step 1: Generate payment data
    const paymentData = generatePaymentData();
    
    // Step 2: Initiate payment based on type
    let paymentResult;
    if (paymentData.type === 'stripe') {
      paymentResult = initiateStripePayment(paymentData);
      stripePaymentRate.add(true);
    } else if (paymentData.type === 'crypto') {
      paymentResult = initiateCryptoPayment(paymentData);
      cryptoPaymentRate.add(true);
    } else {
      // Fallback to stripe for paypal/other types
      paymentResult = initiateStripePayment(paymentData);
    }

    const { res: initiateRes, duration: initDuration, type } = paymentResult;

    // Check initiation success
    const initSuccess = check(initiateRes, {
      'payment initiated: status 201 or 200': (r) => r.status === 201 || r.status === 200,
      'has transaction ID': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.transactionId !== undefined || body.id !== undefined;
        } catch (e) {
          return false;
        }
      },
      'initiation time < 1s': (r) => r.timings.duration < 1000,
    });

    if (!initSuccess) {
      paymentErrors.add(1);
      paymentSuccessRate.add(false);
      paymentDuration.add(initDuration);
      console.error(`Payment initiation failed: ${initiateRes.body}`);
      sleep(1);
      return;
    }

    // Extract transaction ID
    let transactionId;
    try {
      const body = JSON.parse(initiateRes.body);
      transactionId = body.transactionId || body.id;
    } catch (e) {
      transactionId = null;
    }

    paymentDuration.add(initDuration);

    // Step 3: Simulate payment processing delay
    sleep(Math.random() * 2 + 1); // 1-3 seconds

    // Step 4: Confirm payment (if we have transaction ID)
    if (transactionId) {
      const confirmRes = confirmPayment(transactionId);
      const confirmSuccess = check(confirmRes, {
        'payment confirmed: status 200': (r) => r.status === 200,
        'confirmation time < 2s': (r) => r.timings.duration < 2000,
      });

      if (!confirmSuccess) {
        paymentErrors.add(1);
      }

      // Step 5: Process refund for 20% of transactions
      if (Math.random() < 0.2) {
        sleep(1);
        const refundAmount = Math.floor(paymentData.amount * 0.5); // 50% refund
        const { res: refundRes, duration: refundDuration } = processRefund(transactionId, refundAmount);
        
        const refundSuccess = check(refundRes, {
          'refund processed: status 200': (r) => r.status === 200,
          'refund time < 3s': (r) => refundDuration < 3000,
        });

        refundSuccessRate.add(refundSuccess);
        
        if (!refundSuccess) {
          paymentErrors.add(1);
        }
      }
    }

    // Calculate overall success
    const overallSuccess = initSuccess && (!transactionId || check(confirmRes, { 'status 200': (r) => r.status === 200 }));
    paymentSuccessRate.add(overallSuccess);

    if (overallSuccess) {
      successfulTransactions.add(1);
    } else {
      failedTransactions.add(1);
    }

    // Estimate memory usage based on response size
    const responseBodySize = initiateRes.body ? initiateRes.body.length : 0;
    memoryUsage.add(responseBodySize * 100); // Rough estimate

  } catch (error) {
    paymentErrors.add(1);
    paymentSuccessRate.add(false);
    console.error(`Payment error: ${error.message}`);
  }

  const elapsed = Date.now() - iterationStart;
  console.log(`Payment iteration completed in ${elapsed}ms`);
  
  sleep(1);
}

// Summary export
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    test_type: 'payment_stress_test',
    total_payments: (data.metrics.successful_transactions?.values.count || 0) + 
                    (data.metrics.failed_transactions?.values.count || 0),
    success_rate: ((data.metrics.successful_transactions?.values.count || 0) / 
                   ((data.metrics.successful_transactions?.values.count || 0) + 
                    (data.metrics.failed_transactions?.values.count || 0)) * 100).toFixed(2),
    payment_types: {
      stripe: data.metrics.stripe_payments?.values.count || 0,
      crypto: data.metrics.crypto_payments?.values.count || 0,
    },
    payment_values: {
      high_value: data.metrics.high_value_payments?.values.count || 0,
      low_value: data.metrics.low_value_payments?.values.count || 0,
    },
    duration_stats: {
      avg: data.metrics.payment_duration?.values.avg?.toFixed(2) || '0',
      p95: data.metrics.payment_duration?.values['p(95)']?.toFixed(2) || '0',
      p99: data.metrics.payment_duration?.values['p(99)']?.toFixed(2) || '0',
    },
    refund_success_rate: (data.metrics.refund_success_rate?.values.rate || 0 * 100).toFixed(2),
    error_count: data.metrics.payment_errors?.values.count || 0,
  };

  return {
    'reports/payment-stress-summary.json': JSON.stringify(summary, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const { indent = '', enableColors = false } = options;
  const reset = enableColors ? '\x1b[0m' : '';
  const bold = enableColors ? '\x1b[1m' : '';
  const green = enableColors ? '\x1b[32m' : '';
  const red = enableColors ? '\x1b[31m' : '';
  
  let summary = `${bold}=== Payment Stress Test Results ===${reset}\n`;
  summary += `${indent}Timestamp: ${new Date().toISOString()}\n`;
  summary += `${indent}Total Payments: ${(data.metrics.successful_transactions?.values.count || 0) + 
                                          (data.metrics.failed_transactions?.values.count || 0)}\n`;
  summary += `${indent}Success Rate: ${green}${((data.metrics.successful_transactions?.values.count || 0) / 
                   ((data.metrics.successful_transactions?.values.count || 0) + 
                    (data.metrics.failed_transactions?.values.count || 0)) * 100).toFixed(2)}%${reset}\n`;
  summary += `${bold}\nPayment Types:${reset}\n`;
  summary += `${indent}  Stripe: ${data.metrics.stripe_payments?.values.count || 0}\n`;
  summary += `${indent}  Crypto: ${data.metrics.crypto_payments?.values.count || 0}\n`;
  summary += `${bold}\nDuration Stats:${reset}\n`;
  summary += `${indent}  Average: ${data.metrics.payment_duration?.values.avg?.toFixed(2) || '0'}ms\n`;
  summary += `${indent}  P95: ${data.metrics.payment_duration?.values['p(95)']?.toFixed(2) || '0'}ms\n`;
  summary += `${indent}  P99: ${data.metrics.payment_duration?.values['p(99)']?.toFixed(2) || '0'}ms\n`;
  summary += `${bold}\nErrors:${reset}\n`;
  summary += `${indent}  Total: ${red}${data.metrics.payment_errors?.values.count || 0}${reset}\n`;
  
  return summary;
}
