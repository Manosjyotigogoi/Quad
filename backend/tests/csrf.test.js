import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { csrfHeaderCheck } from '../middleware/csrf.js';

// QD-001-adjacent — Round 2 audit noted that the prior round's CSRF test
// file had `await import('express')` inside a non-async function
// (`buildApp()`), which made the test suite itself fail to parse. The
// broken suite was masking regressions because CI was already red. We
// fix the suite here so it actually runs.

describe('CSRF middleware', () => {
  it('allows GET requests without the header', async () => {
    const app = express();
    app.use(csrfHeaderCheck);
    app.get('/ping', (req, res) => res.json({ ok: true }));
    app.use((err, req, res, next) => res.status(500).json({ message: err.message }));

    const res = await request(app).get('/ping');
    expect(res.status).toBe(200);
  });

  it('blocks POST without the X-Requested-With header', async () => {
    const app = express();
    app.use(csrfHeaderCheck);
    app.post('/save', (req, res) => res.json({ ok: true }));

    const res = await request(app).post('/save').send({ x: 1 });
    expect(res.status).toBe(403);
  });

  it('allows POST with X-Requested-With: XMLHttpRequest', async () => {
    const app = express();
    app.use(csrfHeaderCheck);
    app.post('/save', (req, res) => res.json({ ok: true }));

    const res = await request(app)
      .post('/save')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Content-Type', 'application/json')
      .send({ x: 1 });
    expect(res.status).toBe(200);
  });

  it('blocks PATCH without the header', async () => {
    const app = express();
    app.use(csrfHeaderCheck);
    app.patch('/save', (req, res) => res.json({ ok: true }));

    const res = await request(app).patch('/save').send({ x: 1 });
    expect(res.status).toBe(403);
  });

  it('blocks DELETE without the header', async () => {
    const app = express();
    app.use(csrfHeaderCheck);
    app.delete('/save', (req, res) => res.json({ ok: true }));

    const res = await request(app).delete('/save');
    expect(res.status).toBe(403);
  });
});
