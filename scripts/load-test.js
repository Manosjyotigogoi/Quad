// k6 load-test script for the Quad backend.
//
// Run with:
//   k6 run --vus 50 --duration 60s scripts/load-test.js
//
// Required env:
//   BASE_URL       — backend URL (default http://localhost:5000)
//   METRICS_TOKEN  — bearer token for /metrics (optional, dev default localhost)
//
// What this script does:
//   1. Hits /api/health (liveness) and /api/ready (readiness) continuously.
//   2. Hits /api/listings (read-heavy endpoint with $text + filter).
//   3. Hits /api/listings/:id (single doc + populate).
//   4. Optionally scrapes /metrics for the Prometheus dashboard.
//
// What this script does NOT do:
//   - Authenticated flows (POST /api/listings, /api/orders, etc.) — those
//     require a fixture user with verified status. Add them in a separate
//     script that runs against a staging environment with seeded data.
//   - WebSocket / Socket.io load testing (would need Artillery + engine.io).
//
// Thresholds (k6 will exit non-zero if any of these fail):
//   - p(95) latency < 500ms for GET /api/listings
//   - p(99) latency < 1500ms for GET /api/listings
//   - error rate < 1%
//   - http_req_failed < 1%

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const METRICS_TOKEN = __ENV.METRICS_TOKEN || '';

// Custom metrics
const listingsLatency = new Trend('quad_listings_latency', true);
const readyLatency = new Trend('quad_ready_latency', true);
const errorRate = new Rate('quad_errors');

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // ramp up to 20 VUs over 30s
    { duration: '1m', target: 50 },  // ramp up to 50 VUs
    { duration: '30s', target: 50 }, // hold at 50 VUs
    { duration: '30s', target: 0 }   // ramp down
  ],
  thresholds: {
    // SLO: p95 < 500ms, p99 < 1500ms, error rate < 1%.
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    http_req_failed: ['rate<0.01'],
    quad_errors: ['rate<0.01'],
    quad_listings_latency: ['p(95)<500', 'p(99)<1500'],
    quad_ready_latency: ['p(95)<200']
  }
};

const headers = METRICS_TOKEN ? { Authorization: `Bearer ${METRICS_TOKEN}` } : {};

export default function () {
  // 1. Health check — should always be fast.
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    'health is 200': (r) => r.status === 200
  });
  errorRate.add(healthRes.status !== 200);

  // 2. Readiness check — exercises mongo + env check.
  const readyRes = http.get(`${BASE_URL}/api/ready`);
  readyLatency.add(readyRes.timings.duration);
  check(readyRes, {
    'ready is 200': (r) => r.status === 200
  });
  errorRate.add(readyRes.status !== 200);

  // 3. Listings browse (with various filters).
  const listingsRes = http.get(
    `${BASE_URL}/api/listings?category=textbooks&minPrice=10&maxPrice=100&verifiedOnly=true&page=1&limit=24`
  );
  listingsLatency.add(listingsRes.timings.duration);
  check(listingsRes, {
    'listings is 200': (r) => r.status === 200,
    'listings returns array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.listings);
      } catch {
        return false;
      }
    }
  });
  errorRate.add(listingsRes.status !== 200);

  // 4. Metrics scrape (only if token configured).
  if (METRICS_TOKEN) {
    const metricsRes = http.get(`${BASE_URL}/metrics`, { headers });
    check(metricsRes, {
      'metrics is 200': (r) => r.status === 200
    });
  }

  sleep(0.5); // ~2 req/sec per VU
}

// Final summary stage — print the SLO status.
export function handleSummary(data) {
  const summary = {
    p95_latency_ms: data.metrics.http_req_duration?.values?.['p(95)'] || 'n/a',
    p99_latency_ms: data.metrics.http_req_duration?.values?.['p(99)'] || 'n/a',
    error_rate: data.metrics.http_req_failed?.values?.rate || 'n/a',
    total_requests: data.metrics.http_reqs?.values?.count || 0
  };
  console.log('\n--- LOAD TEST SUMMARY ---');
  console.log(JSON.stringify(summary, null, 2));
  return {
    stdout: JSON.stringify(data, null, 2)
  };
}
