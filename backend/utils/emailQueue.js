import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import nodemailer from 'nodemailer';
import { logger } from './logger.js';
import { emailsQueuedTotal, emailsSentTotal, emailFailuresTotal, emailQueueWaitingGauge, emailQueueActiveGauge, emailQueueFailedGauge } from './metrics.js';

// QD-027 — Async email dispatch via BullMQ on Redis.
//
// Round 2 audit found email sending was awaited inline in the request
// path (authController.register, orderController.notifyOrderUpdate,
// adminController.applyVerificationDecision, etc.). Under load, SMTP
// latency (often 1-3s) stalled unrelated requests because the Express
// worker was blocked on the SMTP socket.
//
// We now enqueue every email to a BullMQ queue and a background worker
// consumes them with retry/backoff. The HTTP response returns
// immediately; the email gets sent in the background.
//
// If REDIS_URL is not set (local dev), we fall back to the inline
// sendEmail so local `npm run dev` works without a Redis sidecar.

let queue = null;
let worker = null;
let connection = null;
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
    family: 4 // force IPv4 to avoid IPv6 DNS issues in some environments
  });
  return transporter;
}

function getConnection() {
  if (connection) return connection;
  if (!process.env.REDIS_URL) return null;
  connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  connection.on('error', (err) => {
    logger.error({ err }, '[email-queue] Redis error');
  });
  return connection;
}

function getQueue() {
  if (queue) return queue;
  const conn = getConnection();
  if (!conn) return null;
  queue = new Queue('email', {
    connection: conn,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 1000
    }
  });
  return queue;
}

function startWorker() {
  const conn = getConnection();
  if (!conn) return;
  if (worker) return;

  // THIRD-PASS HARDENING — tune BullMQ concurrency + per-job timeout.
  // Defaults: concurrency=1, maxStalledCount=1, stalledInterval=30s,
  // lockDuration=30s. With nodemailer's 60s socket timeout × 5 retries,
  // one bad email could occupy the queue for 5 minutes. We now:
  //   - concurrency=5 so a bad email doesn't block legitimate ones
  //   - lockDuration=60s so we have headroom on slow SMTP responses
  //   - maxStalledCount=3 so a stuck job is retried before being marked failed
  worker = new Worker(
    'email',
    async (job) => {
      const { to, subject, text, html } = job.data;
      const t = getTransporter();
      if (!t) {
        // Dev fallback — log to console so OTP flows still work.
        logger.info(
          { to, subject },
          '[email-queue] dev fallback — SMTP not configured, logging instead'
        );
        console.log('\n----- EMAIL (dev fallback, SMTP not configured) -----');
        console.log(`To: ${to}\nSubject: ${subject}\n\n${text}`);
        console.log('-------------------------------------------------------\n');
        return { devFallback: true };
      }
      // Per-job timeout — race sendMail against a 15s ceiling so a
      // malicious MX that accepts the TCP connection but never responds
      // can't hold the worker forever.
      const result = await Promise.race([
        t.sendMail({
          from: process.env.SMTP_FROM || 'Quad <no-reply@quad.app>',
          to,
          subject,
          text,
          html
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('SMTP send timed out after 15s')), 15000)
        )
      ]);
      emailsSentTotal.inc();
      return result;
    },
    {
      connection: conn,
      concurrency: Number(process.env.EMAIL_WORKER_CONCURRENCY) || 5,
      lockDuration: 60_000,
      maxStalledCount: 3,
      stalledInterval: 30_000
    }
  );
  worker.on('failed', (job, err) => {
    emailFailuresTotal.inc();
    logger.error(
      { jobId: job?.id, to: job?.data?.to, subject: job?.data?.subject, err: err.message },
      '[email-queue] job failed after all retries'
    );
  });
  // CRITICAL FIX (caught in second-pass audit) — without an 'error'
  // listener, BullMQ worker errors bubble up as unhandledRejection,
  // which the global handler in logger.js turns into process.exit(1).
  // So a Redis outage mid-job would kill the entire backend. Now we
  // log it instead.
  worker.on('error', (err) => {
    logger.error({ err: err.message }, '[email-queue] worker error (non-fatal)');
  });

  // Periodically refresh queue-depth gauges so Prometheus dashboards
  // can show backlog size.
  if (worker) {
    setInterval(async () => {
      try {
        const counts = await worker.getJobCounts();
        emailQueueWaitingGauge.set(counts.waiting || 0);
        emailQueueActiveGauge.set(counts.active || 0);
        emailQueueFailedGauge.set(counts.failed || 0);
      } catch (err) {
        // Non-fatal — metrics collection shouldn't crash anything.
      }
    }, 10_000).unref();
  }

  logger.info(
    { concurrency: Number(process.env.EMAIL_WORKER_CONCURRENCY) || 5 },
    '[email-queue] worker started'
  );
}

// Public API — drop-in replacement for the old sendEmail util.
// Enqueues the email if Redis is available; otherwise calls the
// transporter inline (the original behavior).
//
// CRITICAL FIX (caught in second-pass audit) — the original `q.add()`
// was awaited in the request path with no timeout. BullMQ requires
// ioredis `maxRetriesPerRequest: null` (infinite retries), so if
// Redis was unreachable, `q.add()` would hang indefinitely and block
// every email-sending endpoint (register, resend-otp, password-reset,
// verification submission, order notifications). The whole point of
// the queue was to decouple SMTP latency from the request path;
// instead, the request path was coupled to Redis availability, which
// is strictly worse than the original inline SMTP. We now race
// `q.add()` against a 2s timeout — on timeout, we fall back to the
// inline transporter so the request still returns promptly.
export async function sendEmail({ to, subject, text, html }) {
  const q = getQueue();
  if (!q) {
    // Fallback: inline send (the original behavior, used when Redis
    // isn't configured — e.g. local dev without docker-compose).
    return inlineSend({ to, subject, text, html });
  }
  try {
    // Race the enqueue against a 2s timeout so an unreachable Redis
    // doesn't hang the request. If enqueue times out, fall back to
    // inline send.
    await Promise.race([
      q.add('send', { to, subject, text, html }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('email enqueue timeout (Redis unreachable?)')), 2000)
      )
    ]);
    emailsQueuedTotal.inc();
  } catch (err) {
    logger.warn({ err: err.message, to, subject }, '[email-queue] enqueue failed — falling back to inline send');
    return inlineSend({ to, subject, text, html });
  }
}

// Inline send — used as fallback when Redis is down or not configured.
async function inlineSend({ to, subject, text, html }) {
  const t = getTransporter();
  if (!t) {
    logger.info({ to, subject }, '[email] dev fallback — SMTP not configured');
    console.log('\n----- EMAIL (dev fallback, SMTP not configured) -----');
    console.log(`To: ${to}\nSubject: ${subject}\n\n${text}`);
    console.log('-------------------------------------------------------\n');
    return { devFallback: true };
  }
  return t.sendMail({
    from: process.env.SMTP_FROM || 'Quad <no-reply@quad.app>',
    to,
    subject,
    text,
    html
  });
}

// Call this once at server startup to start the worker.
export function startEmailWorker() {
  startWorker();
}

// For tests / graceful shutdown.
export async function closeEmailQueue() {
  if (worker) await worker.close();
  if (queue) await queue.close();
  if (connection) await connection.quit();
}
