// THIRD-PASS — Sentry-style error alerting stub.
//
// In production, wire this to a real Sentry SDK (or Bugsnag, Rollbar,
// etc.) by setting SENTRY_DSN. Without SENTRY_DSN, errors are logged
// via pino with the `sentry_event` field — a log-based fallback so
// ops can still alert on `level=error` spikes.
//
// Why this matters: pino logs are great for tracing individual
// requests, but they don't aggregate across requests. A spike in 500
// errors from the same code path should page on-call — that requires
// a centralized error-tracking service.
//
// This stub is intentionally NOT a full Sentry integration (which
// would require `@sentry/node` and an init dance). The goal is to
// expose the right hook so a future PR can drop in the real SDK
// without touching every controller.

import { logger } from './logger.js';

let sentryClient = null;

// Initialize Sentry if SENTRY_DSN is configured.
// In a real integration, this would call `Sentry.init({ dsn })`.
// We currently don't install @sentry/node as a dependency because
// we want the audit to remain at 0 vulnerabilities and the Sentry
// SDK adds several transitive deps. When you're ready to wire it up:
//
//   npm install @sentry/node
//
// And replace this file with:
//
//   import Sentry from '@sentry/node';
//   if (process.env.SENTRY_DSN) {
//     Sentry.init({
//       dsn: process.env.SENTRY_DSN,
//       environment: process.env.NODE_ENV,
//       tracesSampleRate: 0.1,
//       release: process.env.GIT_SHA
//     });
//   }
//   export function captureException(err, context = {}) {
//     if (!process.env.SENTRY_DSN) {
//       logger.error({ err, sentry_event: true, ...context }, 'exception captured (no Sentry)');
//       return;
//     }
//     Sentry.captureException(err, { extra: context });
//   }
//   export function setUserContext(user) { Sentry.setUser(user); }

export function captureException(err, context = {}) {
  // No Sentry SDK installed — log via pino with a `sentry_event` marker
  // so a log-based alert (e.g. Loki rule) can page on-call when the
  // error rate spikes.
  logger.error(
    {
      err: { message: err.message, stack: err.stack, name: err.name, code: err.code },
      sentry_event: true,
      ...context
    },
    `[sentry-stub] ${err.message}`
  );
}

export function setUserContext(user) {
  // No-op stub. With a real Sentry SDK, this would call Sentry.setUser().
  if (user) {
    logger.debug({ userId: String(user._id || user.id || '') }, '[sentry-stub] user context set');
  }
}

export { sentryClient };
