import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

// QD-016 — Per-request logging middleware.
//
// Generates a request-id (or honors an inbound X-Request-Id header so
// traces propagate from upstream gateways), attaches it to req.id, and
// logs every request at completion with method, url, status, and
// elapsed time. The errorHandler reads req.id so error logs are
// correlated back to the originating request.
//
// CRITICAL FIX (caught in second-pass audit) — the original code logged
// req.originalUrl verbatim. The verification email-link endpoint puts
// the raw 64-char single-use token in the query string:
//   GET /api/admin/verify-via-email?token=<RAW_TOKEN>&action=approve
// Anyone with log read access could replay that token within the 72h
// TTL. We now sanitize the URL by stripping the `token` query param
// before logging.

export function requestId(req, res, next) {
  const inboundId = req.headers['x-request-id'];
  req.id = inboundId || uuidv4();
  res.setHeader('X-Request-Id', req.id);
  next();
}

// Strip sensitive query params from a URL before logging.
function sanitizeUrl(originalUrl = '') {
  return String(originalUrl).replace(/([?&])token=[^&]*/gi, '$1token=[REDACTED]');
}

// Logs the request at completion. We don't log the request body — too
// risky for leaking credentials in logs (the pino redact config above
// catches the obvious paths but it's safer to just not log bodies).
export function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info(
      {
        req: {
          method: req.method,
          url: sanitizeUrl(req.originalUrl),
          id: req.id
        },
        res: { statusCode: res.statusCode },
        elapsedMs: Math.round(elapsedMs * 100) / 100
      },
      `${req.method} ${sanitizeUrl(req.originalUrl)} ${res.statusCode} ${Math.round(elapsedMs)}ms`
    );
  });
  next();
}
