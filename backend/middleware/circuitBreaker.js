// THIRD-PASS HARDENING — simple circuit breaker for outbound HTTP calls.
//
// Why we need it: when an upstream (Cloudinary, SMTP provider) goes down,
// every request that depends on it blocks on the TCP timeout (often 30-60s
// for the default). Under load, this exhausts the Node event loop and
// takes the whole backend down — a cascading-failure pattern.
//
// This circuit breaker tracks failures per upstream. When the failure
// count exceeds THRESHOLD within WINDOW_MS, the circuit "opens" —
// subsequent calls short-circuit with a fast 503 instead of hitting
// the dead upstream. After RESET_MS, the circuit "half-opens" — one
// trial request is allowed; if it succeeds, the circuit closes; if
// it fails, the circuit re-opens for another RESET_MS.
//
// Usage:
//   import { withCircuit, cloudinaryBreaker } from '../middleware/circuitBreaker.js';
//   await withCircuit(cloudinaryBreaker, () => cloudinary.uploader.upload(...));

const DEFAULT_THRESHOLD = 5;
const DEFAULT_WINDOW_MS = 60_000; // 1 min
const DEFAULT_RESET_MS = 30_000; // 30s half-open after opening

class CircuitBreaker {
  constructor(name, opts = {}) {
    this.name = name;
    this.threshold = opts.threshold || DEFAULT_THRESHOLD;
    this.windowMs = opts.windowMs || DEFAULT_WINDOW_MS;
    this.resetMs = opts.resetMs || DEFAULT_RESET_MS;
    this.failures = []; // timestamps
    this.state = 'closed'; // closed | open | half-open
    this.openedAt = null;
  }

  recordSuccess() {
    this.failures = [];
    if (this.state !== 'closed') {
      this.state = 'closed';
      this.openedAt = null;
    }
  }

  recordFailure() {
    const now = Date.now();
    this.failures.push(now);
    // Drop failures older than windowMs.
    this.failures = this.failures.filter((t) => now - t < this.windowMs);
    if (this.failures.length >= this.threshold) {
      this.state = 'open';
      this.openedAt = now;
    }
  }

  allow() {
    if (this.state === 'open') {
      // Half-open after resetMs.
      if (Date.now() - this.openedAt > this.resetMs) {
        this.state = 'half-open';
        return true;
      }
      return false;
    }
    return true;
  }
}

export function withCircuit(breaker, fn) {
  return new Promise((resolve, reject) => {
    if (!breaker.allow()) {
      const err = new Error(`Circuit breaker "${breaker.name}" is OPEN — upstream appears to be down`);
      err.code = 'CIRCUIT_OPEN';
      err.circuitBreaker = breaker.name;
      return reject(err);
    }
    Promise.resolve()
      .then(() => fn())
      .then(
        (result) => {
          breaker.recordSuccess();
          resolve(result);
        },
        (err) => {
          breaker.recordFailure();
          reject(err);
        }
      );
  });
}

// Pre-wired breakers for the upstreams we care about.
export const cloudinaryBreaker = new CircuitBreaker('cloudinary', {
  threshold: 5,
  windowMs: 60_000,
  resetMs: 30_000
});

export const smtpBreaker = new CircuitBreaker('smtp', {
  threshold: 10,
  windowMs: 60_000,
  resetMs: 60_000
});

// Exported for tests / metrics.
export { CircuitBreaker };
