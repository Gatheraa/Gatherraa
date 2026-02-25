import http from 'k6/http';
import { check, sleep } from 'k6';

// Chaos Test: Spike testing to verify system recovery
export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { target: 10, duration: '10s' },  // Warm up
        { target: 200, duration: '10s' }, // Spike to 200 req/s
        { target: 10, duration: '20s' },  // Recovery period
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.10'], // Allow higher failure rate during chaos
  },
};

const BASE_URL = 'http://localhost:3000';

export default function () {
  http.get(`${BASE_URL}/payments/health/check`);
  sleep(0.5);
}