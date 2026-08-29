import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Prometheus metrics for the Quad backend.
//
// Exposed at GET /metrics (auth-gated behind a bearer token via
// METRICS_TOKEN env var; otherwise only accessible from localhost).
// Scraped by Prometheus / Grafana / VictoriaMetrics for dashboards.
//
// Why this matters: pino gives us per-request LOGS but no aggregated
// signal. For SLO tracking ("p99 latency < 500ms", "error rate < 1%")
// we need TIMESERIES data — counters that increment per-request,
// histograms that observe latency, gauges that snapshot current state.

const register = new Registry();
collectDefaultMetrics({ register, prefix: 'quad_' });

// HTTP request counters — labeled by method, route, status.
// Route is the Express route pattern (e.g. '/api/listings/:id'), not
// the actual URL (which would have unbounded cardinality from IDs).
export const httpRequestTotal = new Counter({
  name: 'quad_http_requests_total',
  help: 'Total HTTP requests handled',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

export const httpRequestDurationSeconds = new Histogram({
  name: 'quad_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register]
});

// Per-business-event counters — for SLO dashboards.
export const ordersAcceptedTotal = new Counter({
  name: 'quad_orders_accepted_total',
  help: 'Total orders accepted by sellers',
  registers: [register]
});

export const ordersRejectedTotal = new Counter({
  name: 'quad_orders_rejected_total',
  help: 'Total orders rejected by sellers',
  registers: [register]
});

export const ordersCancelledTotal = new Counter({
  name: 'quad_orders_cancelled_total',
  help: 'Total orders cancelled by buyers',
  registers: [register]
});

export const verificationsApprovedTotal = new Counter({
  name: 'quad_verifications_approved_total',
  help: 'Total student verifications approved (dashboard + email-link)',
  labelNames: ['via'],
  registers: [register]
});

export const verificationsRejectedTotal = new Counter({
  name: 'quad_verifications_rejected_total',
  help: 'Total student verifications rejected (dashboard + email-link)',
  labelNames: ['via'],
  registers: [register]
});

export const emailsQueuedTotal = new Counter({
  name: 'quad_emails_queued_total',
  help: 'Total emails enqueued to BullMQ',
  registers: [register]
});

export const emailsSentTotal = new Counter({
  name: 'quad_emails_sent_total',
  help: 'Total emails successfully sent by the worker',
  registers: [register]
});

export const emailFailuresTotal = new Counter({
  name: 'quad_email_failures_total',
  help: 'Total emails that failed after all retries',
  registers: [register]
});

// Gauges — snapshot of current state, scraped on each interval.
export const activeConnectionsGauge = new Gauge({
  name: 'quad_active_connections',
  help: 'Currently in-flight HTTP requests',
  registers: [register]
});

export const dbConnectionStateGauge = new Gauge({
  name: 'quad_db_connection_state',
  help: 'MongoDB connection state (1 = connected, 0 = disconnected)',
  registers: [register]
});

export const readinessGauge = new Gauge({
  name: 'quad_readiness',
  help: '1 if /ready would return 200, 0 otherwise',
  registers: [register]
});

// BullMQ queue depth gauges — populated by the worker.
export const emailQueueWaitingGauge = new Gauge({
  name: 'quad_email_queue_waiting',
  help: 'Number of email jobs waiting in the BullMQ queue',
  registers: [register]
});

export const emailQueueActiveGauge = new Gauge({
  name: 'quad_email_queue_active',
  help: 'Number of email jobs currently being processed',
  registers: [register]
});

export const emailQueueFailedGauge = new Gauge({
  name: 'quad_email_queue_failed',
  help: 'Number of email jobs in failed state (after all retries)',
  registers: [register]
});

export { register };
