import { register, httpRequestTotal, httpRequestDurationSeconds, activeConnectionsGauge } from '../utils/metrics.js';

// QD-016 + new Prometheus metrics — wraps every request to record:
//   - active connection count (gauge)
//   - request count (counter, labeled method/route/status)
//   - request duration (histogram, same labels)
//
// Route is the Express route pattern (e.g. '/api/listings/:id') NOT
// the actual URL — IDs would cause unbounded cardinality. We extract
// the pattern from req.route.path if available, else fall back to the
// raw path with the last segment masked.

function getRoutePattern(req) {
  if (req.route?.path && req.baseUrl) {
    return `${req.baseUrl}${req.route.path}`;
  }
  if (req.route?.path) {
    return req.route.path;
  }
  // Fallback: mask the last path segment if it looks like an ID.
  const path = req.path || '/';
  const segments = path.split('/');
  if (segments.length > 2) {
    const last = segments[segments.length - 1];
    if (last.length === 24 || /^[0-9a-f]{24}$/i.test(last) || /^\d+$/.test(last)) {
      segments[segments.length - 1] = ':id';
      return segments.join('/');
    }
  }
  return path;
}

export function metricsMiddleware(req, res, next) {
  activeConnectionsGauge.inc();
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    activeConnectionsGauge.dec();
    const elapsedNs = Number(process.hrtime.bigint() - start);
    const elapsedSeconds = elapsedNs / 1e9;
    const route = getRoutePattern(req);
    const labels = {
      method: req.method,
      route,
      status: String(res.statusCode)
    };
    httpRequestTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, elapsedSeconds);
  });

  next();
}

// GET /metrics — Prometheus scrape endpoint.
// Auth-gated via METRICS_TOKEN env var (bearer token). If unset, only
// localhost requests are allowed (defense-in-depth for the dev case).
import { logger } from '../utils/logger.js';

export async function metricsHandler(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (process.env.METRICS_TOKEN) {
    if (token !== process.env.METRICS_TOKEN) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
  } else {
    // No token configured — restrict to localhost only.
    const ip = req.ip || req.socket?.remoteAddress || '';
    if (!ip.startsWith('127.0.0.1') && !ip.startsWith('::1') && !ip.startsWith('::ffff:127.0.0.1')) {
      res.status(403).json({ message: 'Metrics endpoint requires METRICS_TOKEN or localhost access' });
      return;
    }
  }

  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    logger.error({ err: err.message }, '[metrics] failed to render metrics');
    res.status(500).json({ message: 'Metrics rendering failed' });
  }
}
