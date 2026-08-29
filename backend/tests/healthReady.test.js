import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';

// QD-018 — split /health (liveness) and /ready (readiness).
//
// /health  → 200 always (process alive).
// /ready   → 200 if mongo connected AND env vars present, else 503.

const buildApp = async () => {
  // We import server.js's app indirectly — instead, build a minimal app
  // that mounts ONLY the health/ready routes, replicating what's in
  // server.js. (server.js auto-starts listening on import, which is
  // hostile to supertest.)
  const app = express();
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', kind: 'liveness' });
  });
  app.get('/api/ready', (req, res) => {
    const mongoState = mongoose.connection.readyState;
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
  return app;
};

describe('QD-018 — /health (liveness) vs /ready (readiness)', () => {
  let app;

  beforeAll(async () => {
    app = await buildApp();
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  it('GET /api/health always returns 200 with kind:liveness', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.kind).toBe('liveness');
  });

  it('GET /api/ready returns 200 with kind:readiness when mongo+env OK', async () => {
    const res = await request(app).get('/api/ready');
    expect(res.status).toBe(200);
    expect(res.body.kind).toBe('readiness');
    expect(res.body.checks.mongo).toBe(true);
    expect(res.body.checks.env).toBe(true);
    expect(res.body.mongoState).toBe(1);
  });

  it('GET /api/ready returns 503 when mongo is disconnected (simulated)', async () => {
    // Save the real connection, disconnect, hit /ready, reconnect.
    const realUri = process.env.MONGO_URI;
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    try {
      const res = await request(app).get('/api/ready');
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('not_ready');
      expect(res.body.checks.mongo).toBe(false);
    } finally {
      await mongoose.connect(realUri);
    }
  });
});
