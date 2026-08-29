import { logger } from '../utils/logger.js';
import { captureException } from '../utils/errorReporting.js';

// Normalizes error responses so the client always gets a clean JSON
// message. Stack traces are only exposed in non-production so a
// misconfigured production deployment never leaks internals.
//
// QD-016 — Logs every error with the request-id so a production
// incident can be traced from the log line back to the originating
// request.
//
// CRITICAL FIX (caught in second-pass audit) — sanitize
// req.originalUrl before logging so the verification email-link
// token doesn't end up in error logs.

function sanitizeUrl(originalUrl = '') {
  return String(originalUrl).replace(/([?&])token=[^&]*/gi, '$1token=[REDACTED]');
}

export function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Route not found: ${sanitizeUrl(req.originalUrl)}`));
}

export function errorHandler(err, req, res, next) {
  let statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  let message = err.message || 'Server error';

  // Mongoose duplicate key (e.g. email/phone already registered).
  // Normalize to a single, non-enumerating message so the client can't
  // tell whether a specific email is already registered.
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0];
    // For registration specifically, revealing "that email is already
    // registered" is an enumeration oracle — use a generic message.
    if (field === 'email' || field === 'phone') {
      message = 'An account with those details already exists.';
    } else {
      message = field ? `That ${field} is already in use.` : 'Duplicate value';
    }
  }

  // Mongoose validation error.
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  }

  // Mongoose CastError (e.g. invalid ObjectId that slipped past
  // guardObjectId) — normalize to 400 instead of letting it bubble as 500.
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.message}`;
  }

  // Multer file-size / file-filter errors.
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      statusCode = 413;
      message = 'That file is too large. Please upload a smaller image.';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      statusCode = 400;
      message = 'Too many files. You can upload up to 6 photos per listing.';
    } else {
      statusCode = 400;
      message = err.message || 'File upload error';
    }
  }

  // JSON parse / malformed body.
  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Invalid request body.';
  }

  // Never expose internal errors / stack traces in production.
  const isProduction = process.env.NODE_ENV === 'production';
  if (statusCode === 500 && isProduction) {
    message = 'Something went wrong on our end. Please try again.';
  }

  // QD-016 — Structured error log with request-id so we can correlate
  // a user-visible "something went wrong" back to the specific request.
  const safeUrl = sanitizeUrl(req.originalUrl);
  if (statusCode >= 500) {
    logger.error(
      {
        req: { id: req.id, method: req.method, url: safeUrl },
        res: { statusCode },
        err: { message: err.message, stack: err.stack, code: err.code, name: err.name }
      },
      `error ${statusCode} ${req.method} ${safeUrl}`
    );
    // THIRD-PASS — forward to Sentry-style error reporting so ops can
    // alert on 5xx spikes. captureException is a no-op stub if
    // SENTRY_DSN is not set (just logs via pino).
    captureException(err, {
      requestId: req.id,
      method: req.method,
      url: safeUrl,
      statusCode,
      userId: req.user?._id ? String(req.user._id) : undefined
    });
  } else if (statusCode >= 400) {
    logger.warn(
      {
        req: { id: req.id, method: req.method, url: safeUrl },
        res: { statusCode },
        err: { message: err.message, name: err.name, code: err.code }
      },
      `client-error ${statusCode} ${req.method} ${safeUrl}`
    );
  }

  res.status(statusCode).json({
    message,
    // Expose the request-id so the user can quote it when reporting
    // an issue (and ops can look it up in the logs).
    requestId: req.id,
    stack: isProduction ? undefined : err.stack
  });
}
