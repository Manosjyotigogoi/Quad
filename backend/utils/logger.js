import pino from 'pino';

// QD-016 — Structured logging via pino.
//
// Round 2 audit found the only logging was dev-mode Morgan (text format,
// no request IDs, no JSON output). On a multi-instance deployment this
// made production debugging effectively impossible: logs weren't
// searchable, errors couldn't be correlated across services, and
// uncaughtException / unhandledRejection silently killed the process
// with no record.
//
// We now:
//  1. Use pino for JSON output (one line per log entry, parseable by
//     ELK / Loki / Datadog / CloudWatch).
//  2. Use pino-http for per-request logging with a generated
//     request-id (so a single user's request can be traced across
//     middleware + error handler + any background work).
//  3. Capture uncaughtException + unhandledRejection and log them
//     before the process exits (so we have a record of WHY it died).
//
// In development, we use pino-pretty for human-readable output.
// In production, we emit raw JSON for machine ingestion.

const isProd = process.env.NODE_ENV === 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  ...(isProd
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' }
        }
      }),
  // Default context attached to every log entry.
  base: {
    service: 'quad-backend',
    env: process.env.NODE_ENV || 'development'
  },
  // Redact sensitive fields so they never end up in logs.
  // CRITICAL FIX (QD-016 regression caught in second-pass audit) —
  // The original redact paths covered req.body.token but NOT
  // req.query.token. The verification email-link endpoint puts the
  // raw, single-use, 64-char verification token in the URL:
  //   GET /api/admin/verify-via-email?token=<RAW_TOKEN>&action=approve
  // The requestLogger logs req.originalUrl verbatim, so the token was
  // ending up in production logs. Anyone with log read access could
  // replay the token via POST /verifications/review-by-token within
  // the 72-hour TTL. We now redact req.query.token AND req.url too.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.passwordHash',
      'req.body.currentPassword',
      'req.body.newPassword',
      'req.body.token',
      'req.body.otp',
      'req.body.otpHash',
      'req.body.resetTokenHash',
      'req.body.verificationTokenHash',
      'req.query.token',
      'req.url',
      'req.originalUrl',
      'res.headers["set-cookie"]'
    ],
    censor: '[REDACTED]'
  }
});

// Captured uncaughtException + unhandledRejection — log them, then exit.
// (We let the process die so the orchestrator restarts us in a clean
// state; a half-broken process continuing to serve traffic is worse
// than a clean restart.)
process.on('uncaughtException', (err) => {
  logger.fatal({ err, type: 'uncaughtException' }, 'uncaughtException — process will exit');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason, type: 'unhandledRejection' }, 'unhandledRejection — process will exit');
  process.exit(1);
});

export default logger;
export { logger };
