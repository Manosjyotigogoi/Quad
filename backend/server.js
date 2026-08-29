import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import compression from 'compression';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

import { connectDB } from './config/db.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { apiRateLimiter, initRateLimiterStore, closeRateLimiterRedis } from './middleware/rateLimiter.js';
import { csrfHeaderCheck } from './middleware/csrf.js';
import { requestId, requestLogger } from './middleware/requestLogger.js';
import { metricsMiddleware, metricsHandler } from './middleware/metrics.js';
import { logger } from './utils/logger.js';
import { startEmailWorker, closeEmailQueue } from './utils/emailQueue.js';
import { setupSocketIO } from './realtime/socket.js';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import listingRoutes from './routes/listingRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import orderRoutes from './routes/orderRoutes.js';

// QD-014 — Startup assertion for COLLEGE_EMAIL_DOMAIN.
//
// The .env.example shipped with `COLLEGE_EMAIL_DOMAIN=gmail.com`, which
// is a PUBLIC provider — accepting any @gmail.com address would let
// anyone in the world sign up, defeating the entire "campus-only"
// verification gate. Round 2 audit found this was silently defaulting
// without any check.
//
// We now fail startup loudly if the env var is missing OR is set to a
// denylist of well-known public providers. This is a process-fatal
// assertion — boot-check.mjs will catch it.
const PUBLIC_PROVIDER_DENYLIST = new Set([
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'proton.me',
  'protonmail.com',
  'aol.com',
  'zoho.com',
  'mail.com',
  'gmx.com'
]);

function assertCollegeEmailDomain() {
  const domain = (process.env.COLLEGE_EMAIL_DOMAIN || '').toLowerCase().trim();
  if (!domain) {
    console.error(
      '[startup] FATAL: COLLEGE_EMAIL_DOMAIN is not set. ' +
        'Set it to your campus email domain (e.g. lpu.in) in your .env file.'
    );
    process.exit(1);
  }
  if (PUBLIC_PROVIDER_DENYLIST.has(domain)) {
    console.error(
      `[startup] FATAL: COLLEGE_EMAIL_DOMAIN is set to "${domain}", which is a public email provider. ` +
        'A public provider would let anyone in the world sign up, defeating the campus-only gate. ' +
        'Set it to your campus email domain (e.g. lpu.in) in your .env file.'
    );
    process.exit(1);
  }
  // Must look like a domain — at least one dot, no spaces, no @ symbol.
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    console.error(
      `[startup] FATAL: COLLEGE_EMAIL_DOMAIN "${domain}" does not look like a valid domain. ` +
        'Set it to your campus email domain (e.g. lpu.in) in your .env file.'
    );
    process.exit(1);
  }
}

assertCollegeEmailDomain();

const app = express();

// ---- Security middleware --------------------------------------------------

// QD-032 — HSTS only in production so local HTTP dev isn't HSTS-pinned.
// Round 2 audit found that HSTS was being applied even in dev, which
// made local http://localhost testing painful because the browser
// cached the HSTS pin and refused plain HTTP for the next 30 days.
app.use(
  helmet({
    // QD-035 — In development, run a permissive-but-present CSP in
    // report-only mode so devs catch missing-script-src issues
    // before they hit production. In production, run a strict CSP.
    contentSecurityPolicy:
      process.env.NODE_ENV === 'production'
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
              imgSrc: ["'self'", 'data:', 'https:'], // Cloudinary images
              connectSrc: ["'self'", 'ws:', 'wss:'], // Socket.io
              frameAncestors: ["'none'"]
            }
          }
        : process.env.CSP_REPORT_ONLY === 'true'
          ? {
              // Permissive report-only CSP for dev — catches violations
              // without breaking anything.
              reportOnly: true,
              directives: {
                defaultSrc: ["'self'", '*'],
                scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", '*'],
                styleSrc: ["'self'", "'unsafe-inline'", '*'],
                imgSrc: ['*'],
                connectSrc: ["'self'", 'ws:', 'wss:', '*'],
                reportUri: '/api/csp-report'
              }
            }
          : false,
    // QD-032 — strict-transport-Security only set when NODE_ENV=production.
    hsts:
      process.env.NODE_ENV === 'production'
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
  })
);

// Mongo sanitize strips $ and . from req.body / req.query / req.params
// so operators like { $gt: "" } can't be injected into Mongoose queries.
app.use(mongoSanitize());

// QD-028 — compression middleware for gzip/deflate on responses.
// Disabled for /api/health and /api/ready (tiny endpoints, not worth
// the per-request compression overhead) and for SSE / Socket.io
// upgrades (compression breaks those).
app.use(
  compression({
    filter: (req, res) => {
      if (req.path === '/api/health' || req.path === '/api/ready') return false;
      return compression.filter(req, res);
    }
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// QD-016 — Request-id + structured request logging. Mounted BEFORE
// the morgan dev logger so the request-id is available everywhere.
app.use(requestId);
app.use(requestLogger);

// Prometheus metrics middleware — records per-request latency + status.
app.use(metricsMiddleware);

// Prometheus scrape endpoint. Not under /api/* so it's not rate-limited
// or CSRF-checked. Auth-gated inside the handler (bearer token OR localhost).
app.get('/metrics', metricsHandler);

if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// General rate limiter — applied to every route.
app.use('/api', apiRateLimiter);

// CSRF protection — requires X-Requested-With header on all
// state-changing requests (POST/PUT/PATCH/DELETE).
app.use('/api', csrfHeaderCheck);

// ---- Routes ---------------------------------------------------------------

// QD-018 — split into liveness (/health) and readiness (/ready).
//
// /health  → 200 always, as long as the Node process is alive. Use this
//            for liveness probes — never points away from traffic just
//            because a downstream dependency is briefly unavailable.
//
// /ready   → 200 only when mongoose.connection.readyState === 1 (i.e.
//            "connected") AND required env vars (JWT_SECRET,
//            COLLEGE_EMAIL_DOMAIN) are present. Point load-balancer /
//            orchestrator readiness probes here so a backend that has
//            lost its DB connection stops receiving traffic until it
//            recovers.
//
// /ready is also flipped to false immediately on SIGTERM/SIGINT (QD-017)
// so the orchestrator stops sending new traffic during graceful
// shutdown.
let isShuttingDown = false;
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', kind: 'liveness' });
});

app.get('/api/ready', (req, res) => {
  if (isShuttingDown) {
    return res.status(503).json({
      status: 'shutting_down',
      kind: 'readiness',
      checks: { mongo: mongoose.connection.readyState === 1, env: true, shuttingDown: true }
    });
  }
  const mongoState = mongoose.connection.readyState;
  // 1 = connected. 2 = connecting (transient — fail readiness so the
  // orchestrator retries). 0/3/99 = disconnected.
  const mongoOk = mongoState === 1;
  const envOk = Boolean(process.env.JWT_SECRET) && Boolean(process.env.COLLEGE_EMAIL_DOMAIN);
  const ok = mongoOk && envOk;
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ready' : 'not_ready',
    kind: 'readiness',
    checks: { mongo: mongoOk, env: envOk },
    mongoState
  });
});

// CSP report endpoint — receives report-only CSP violations in dev.
// CRITICAL FIX (caught in second-pass audit) — browsers POST CSP
// violations with Content-Type: application/csp-report (legacy) or
// application/reports+json (Reporting API). The global express.json()
// middleware only parses application/json, so the report body was
// silently dropped. We add a route-specific body parser that accepts
// all three content types.
app.post(
  '/api/csp-report',
  express.json({
    type: ['application/json', 'application/csp-report', 'application/reports+json'],
    limit: '1mb'
  }),
  (req, res) => {
    logger.warn({ cspReport: req.body }, 'CSP violation (report-only)');
    res.status(204).end();
  }
);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);

// QD-031 — Production catch-all: serve index.html for any non-API route
// so SPA deep-links survive a refresh. Keeps JSON 404 for /api/*.
//
// CRITICAL FIX (caught in second-pass audit) — the original code used
// `import('path').then(...)` to register the catch-all asynchronously,
// which meant the catch-all was registered AFTER `app.use(notFound)`
// and `app.use(errorHandler)`. Express middleware runs in registration
// order, so every non-API route hit `notFound` → returned JSON 404, and
// the catch-all never ran. SPA deep-link refresh was completely broken
// in production.
//
// We now use a top-level static `import path from 'path'` and register
// the catch-all synchronously BEFORE notFound, which is the correct
// order.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = process.env.FRONTEND_DIST || path.resolve(__dirname, 'public');

if (process.env.NODE_ENV === 'production') {
  // QD-028 — Cache headers: hashed Vite assets get immutable + 1y;
  // index.html is no-cache so a new deploy's hash is picked up
  // immediately.
  app.use(
    express.static(frontendDist, {
      maxAge: '1y',
      immutable: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      }
    })
  );

  // Any GET that isn't /api/* serves index.html (SPA routing).
  // Anything that IS /api/* falls through to notFound → JSON 404.
  app.get(/^\/(?!api).*/, (req, res, next) => {
    res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
      if (err) {
        logger.error({ err, path: req.path }, '[spa-catch-all] sendFile failed');
        next();
      }
    });
  });
}

app.use(notFound);
app.use(errorHandler);

// ---- HTTP server + Socket.io -----------------------------------------------

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
  }
});

// Wire up the real-time event handlers (auth via JWT cookie, rooms, etc.).
setupSocketIO(io);

const PORT = process.env.PORT || 5000;

connectDB()
  .then(async () => {
    // QD-013 — Initialize the shared Redis rate-limit store (falls back
    // to in-memory if REDIS_URL is missing or Redis is unreachable).
    await initRateLimiterStore();
    // QD-027 — Start the BullMQ email worker so queued sends get
    // processed in the background.
    startEmailWorker();
    httpServer.listen(PORT, () => {
      logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, `Quad API + Socket.io running on port ${PORT}`);
    });
  })
  .catch((err) => {
    logger.fatal({ err }, `Failed to connect to MongoDB: ${err.message}`);
    process.exit(1);
  });

// ---- Graceful shutdown (QD-017) -------------------------------------------
//
// On SIGTERM (orchestrator-initiated) or SIGINT (Ctrl-C in dev):
//  1. Flip /ready to false immediately so the LB stops sending new traffic.
//  2. Stop accepting new connections (httpServer.close).
//  3. Close Socket.IO.
//  4. Disconnect Mongoose.
//  5. Force-exit after a 30s grace timeout (so a stuck connection
//     doesn't keep the process alive forever).
const SHUTDOWN_TIMEOUT_MS = 30_000;
let shuttingDown = false;

function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  isShuttingDown = true;

  logger.info({ signal }, 'Graceful shutdown initiated — flipping /ready to false');

  const forceExit = setTimeout(() => {
    logger.fatal({ signal }, 'Graceful shutdown timeout — force-exiting');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  Promise.allSettled([
    new Promise((resolve) => {
      io.close(() => resolve());
      // If io.close hangs, force it after 5s.
      setTimeout(() => resolve(), 5000).unref();
    }),
    new Promise((resolve) => {
      httpServer.close(() => resolve());
      setTimeout(() => resolve(), 5000).unref();
    }),
    mongoose.disconnect(),
    closeEmailQueue(),
    closeRateLimiterRedis()
  ]).then((results) => {
    logger.info({ signal, results: results.map((r) => r.status === 'rejected' ? { status: 'rejected', reason: r.reason?.message } : r.status) }, 'Graceful shutdown complete — exiting');
    clearTimeout(forceExit);
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { io };
