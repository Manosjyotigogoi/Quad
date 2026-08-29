import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import IORedis from 'ioredis';

// QD-013 — Shared rate-limit store.
//
// Round 2 audit found the rate limiter was using express-rate-limit's
// default in-memory store, which (a) resets on every restart and (b)
// doesn't share state across instances under a load balancer — so a
// 4-instance deployment effectively gave attackers 4x the budget.
//
// We now use rate-limit-redis (v4.3.1 — last version compatible with
// express-rate-limit 7.x) backed by Redis when REDIS_URL is configured.
// If Redis is NOT configured (e.g. local dev without docker-compose),
// we fall back to the in-memory default so local `npm run dev` still
// works without a Redis sidecar.
//
// CRITICAL FIX (caught in second-pass audit) — the original code
// returned a RedisStore wrapping an ioredis client whose
// `maxRetriesPerRequest` was unset (defaults to null in ioredis v5+,
// meaning infinite retries). If REDIS_URL was set but Redis was
// UNREACHABLE, every rate-limited request hung indefinitely because
// the underlying INCR command never resolved. We now:
//   1. Try an explicit `await ping()` with a short timeout on init.
//   2. If it fails, fall back to in-memory + log a warning.
//   3. Set `maxRetriesPerRequest: 1` so a downed Redis returns errors
//      fast instead of hanging the request.

let sharedStore = null;
let redisClient = null;
let redisStateChecked = false;

async function getStore() {
  if (sharedStore || redisStateChecked) return sharedStore;

  if (!process.env.REDIS_URL) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(
        '[rate-limiter] REDIS_URL not set — falling back to in-memory store. ' +
          'Rate limits will NOT be shared across instances and will reset on restart.'
      );
    }
    redisStateChecked = true;
    return undefined; // express-rate-limit's default
  }

  try {
    redisClient = new IORedis(process.env.REDIS_URL, {
      // Critical: don't hang the request path on Redis being unreachable.
      // ioredis v6 defaults to null (infinite retry) which we must override.
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      // Short retry strategy so a transient Redis flap recovers quickly.
      retryStrategy: (times) => Math.min(times * 100, 1000)
    });
    redisClient.on('error', (err) => {
      console.error('[rate-limiter] Redis error:', err.message);
    });

    // Verify the connection actually works before wiring it into the
    // rate limiter. If the ping fails (Redis down at boot), fall back
    // to in-memory so the app still boots.
    await Promise.race([
      redisClient.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('ping timeout')), 2000))
    ]);

    sharedStore = new RedisStore({
      sendCommand: (...args) => redisClient.call(...args)
    });
    redisStateChecked = true;
    console.log('[rate-limiter] Redis store initialized — rate limits shared across instances.');
    return sharedStore;
  } catch (err) {
    console.error('[rate-limiter] Redis unreachable, falling back to in-memory store:', err.message);
    if (redisClient) {
      try { redisClient.disconnect(); } catch {}
      redisClient = null;
    }
    sharedStore = undefined;
    redisStateChecked = true;
    return sharedStore;
  }
}

const commonOpts = {
  standardHeaders: true,
  legacyHeaders: false
  // NOTE: store is set below after async init.
};

// Strict limiter for OTP verify + login — these are the highest-risk
// brute-force / credential-stuffing targets.
export const authRateLimiter = rateLimit({
  ...commonOpts,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per IP per window
  message: { message: 'Too many attempts. Please try again in 15 minutes.' },
  // Skip rate limiting entirely for /api/health and /api/ready so LB
  // probes don't self-throttle (HIGH fix caught in second-pass audit).
  skip: (req) => req.path === '/api/health' || req.path === '/api/ready'
});

// Looser limiter for OTP resend + register — prevent email-bombing / spam.
export const resendOtpLimiter = rateLimit({
  ...commonOpts,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 resends per IP per hour
  // Comment-vs-code mismatch caught in audit: the original code claimed
  // "per email per hour" but keyed on IP. We now key on email when
  // available, falling back to IP.
  keyGenerator: (req) => req.body?.email || req.ip,
  message: { message: 'Too many code requests. Please try again later.' }
});

// General API limiter — prevents flooding any endpoint.
export const apiRateLimiter = rateLimit({
  ...commonOpts,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests per IP per 15 minutes (~20/min sustained)
  message: { message: 'Too many requests. Please slow down.' },
  skip: (req) => req.path === '/api/health' || req.path === '/api/ready'
});

// Async init — wire the store into all three limiters. Called from
// server.js startup. Failures fall back to in-memory.
export async function initRateLimiterStore() {
  const store = await getStore();
  if (store) {
    authRateLimiter.store = store;
    resendOtpLimiter.store = store;
    apiRateLimiter.store = store;
  }
}

// Called from graceful shutdown — closes the Redis connection so the
// process can exit cleanly.
export async function closeRateLimiterRedis() {
  if (redisClient) {
    try { await redisClient.quit(); } catch {}
  }
}

export { redisClient };
