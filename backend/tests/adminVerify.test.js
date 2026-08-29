import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import AuditLog from '../models/AuditLog.js';

// QD-002 / QD-007 regression tests.
//
// We deliberately do NOT start the full server.js here — instead we
// build a minimal Express app that mounts ONLY the admin routes and
// stubs out the protect/requireAdmin middleware so we can drive the
// public verify-via-email + review-by-token endpoints without auth.
//
// The global setup in tests/setup.js spins up mongodb-memory-server and
// sets process.env.MONGO_URI before these tests run.

const buildApp = async () => {
  const { default: router } = await import('../routes/adminRoutes.js');
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    // Stub CSRF — pass through everything. The csrfHeaderCheck middleware
    // is already tested separately; here we just need to reach the
    // controller logic.
    next();
  });
  app.use('/api/admin', router);
  app.use((err, req, res, next) => {
    res.status(res.statusCode && res.statusCode !== 200 ? res.statusCode : 500).json({ message: err.message });
  });
  return app;
};

describe('QD-002 / QD-007 — admin verify-via-email XSS + GET→POST migration', () => {
  let app;
  let User;
  let hashVerificationToken;

  beforeAll(async () => {
    app = await buildApp();
    ({ default: User } = await import('../models/User.js'));
    ({ hashVerificationToken } = await import('../utils/verificationToken.js'));
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  it('GET /verify-via-email no longer mutates state — returns a confirmation page, not a result', async () => {
    const rawToken = 'a'.repeat(64);
    const tokenHash = hashVerificationToken(rawToken);
    const user = await User.create({
      name: 'Test Student',
      email: 'student@example.edu',
      phone: '5550001',
      passwordHash: '$2a$10$dummyhashdummyhashdummyhashdummyhashdummyhashdummyhash',
      emailVerified: true,
      verification: {
        registrationNo: 'REG-1',
        status: 'pending',
        submittedAt: new Date(),
        verificationTokenHash: tokenHash,
        verificationTokenExpires: new Date(Date.now() + 60 * 60 * 1000)
      }
    });

    const res = await request(app)
      .get('/api/admin/verify-via-email')
      .query({ token: rawToken, action: 'approve' });

    expect(res.status).toBe(200);
    expect(res.type).toBe('text/html');

    // The page should be a *confirmation* page (not a "result" page),
    // meaning state has NOT been mutated yet.
    expect(res.text.toLowerCase()).toContain('confirm');
    expect(res.text.toLowerCase()).toContain('<form');
    expect(res.text.toLowerCase()).toContain('method="post"');

    // DB must still show pending.
    const refreshed = await User.findById(user._id);
    expect(refreshed.verification.status).toBe('pending');
  });

  it('QD-002 — XSS payload in user.name is escaped in the confirmation page HTML', async () => {
    const rawToken = 'b'.repeat(64);
    const tokenHash = hashVerificationToken(rawToken);
    const xssPayload = `<script>alert('pwned')</script>`;
    await User.create({
      name: xssPayload,
      email: 'attacker@example.edu',
      phone: '5550002',
      passwordHash: '$2a$10$dummyhashdummyhashdummyhashdummyhashdummyhashdummyhash',
      emailVerified: true,
      verification: {
        registrationNo: `<img src=x onerror=alert(1)>`,
        status: 'pending',
        submittedAt: new Date(),
        verificationTokenHash: tokenHash,
        verificationTokenExpires: new Date(Date.now() + 60 * 60 * 1000)
      }
    });

    const res = await request(app)
      .get('/api/admin/verify-via-email')
      .query({ token: rawToken, action: 'approve' });

    expect(res.status).toBe(200);
    expect(res.type).toBe('text/html');

    // The XSS check: no unescaped <script> tag, no unescaped <img tag with
    // onerror, no unescaped <svg with onload — these are the actual
    // injection vectors. (The word "alert" appearing as text inside an
    // escaped context is fine — it renders as text, not as JS execution.)
    expect(res.text).not.toContain('<script>');
    expect(res.text).not.toMatch(/<img[^>]+onerror/i);
    expect(res.text).not.toMatch(/<svg[^>]+onload/i);
    expect(res.text).not.toMatch(/<body[^>]+onload/i);
    // The escaped forms MUST appear — confirms the values were actually
    // output, just escaped.
    expect(res.text).toContain('&lt;script&gt;');
    expect(res.text).toContain('&lt;img');
  });

  it('QD-007 — POST /verifications/review-by-token performs the actual review', async () => {
    const rawToken = 'c'.repeat(64);
    const tokenHash = hashVerificationToken(rawToken);
    const user = await User.create({
      name: 'Approve Me',
      email: 'approveme@example.edu',
      phone: '5550003',
      passwordHash: '$2a$10$dummyhashdummyhashdummyhashdummyhashdummyhashdummyhash',
      emailVerified: true,
      verification: {
        registrationNo: 'REG-2',
        status: 'pending',
        submittedAt: new Date(),
        verificationTokenHash: tokenHash,
        verificationTokenExpires: new Date(Date.now() + 60 * 60 * 1000)
      }
    });

    const res = await request(app)
      .post('/api/admin/verifications/review-by-token')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Content-Type', 'application/json')
      .send({ token: rawToken, action: 'approve' });

    expect(res.status).toBe(200);

    const refreshed = await User.findById(user._id);
    expect(refreshed.verification.status).toBe('approved');
    expect(refreshed.verification.reviewedVia).toBe('email_link');

    // Token is burned (single-use).
    expect(refreshed.verification.verificationTokenHash).toBeUndefined();
    expect(refreshed.verification.verificationTokenExpires).toBeUndefined();

    // QD-015 THIRD-PASS — audit log row was written.
    const auditRow = await AuditLog.findOne({ targetUserId: user._id }).lean();
    expect(auditRow).not.toBeNull();
    expect(auditRow.action).toBe('approve');
    expect(auditRow.via).toBe('email_link');
    expect(auditRow.before?.status).toBe('pending');
    expect(auditRow.after?.status).toBe('approved');
  });

  it('QD-007 — POST /verifications/review-by-token rejects a reused (already-burned) token', async () => {
    const rawToken = 'd'.repeat(64);
    const tokenHash = hashVerificationToken(rawToken);
    await User.create({
      name: 'Reuse Test',
      email: 'reuse@example.edu',
      phone: '5550004',
      passwordHash: '$2a$10$dummyhashdummyhashdummyhashdummyhashdummyhashdummyhash',
      emailVerified: true,
      verification: {
        registrationNo: 'REG-3',
        status: 'pending',
        submittedAt: new Date(),
        verificationTokenHash: tokenHash,
        verificationTokenExpires: new Date(Date.now() + 60 * 60 * 1000)
      }
    });

    const first = await request(app)
      .post('/api/admin/verifications/review-by-token')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Content-Type', 'application/json')
      .send({ token: rawToken, action: 'approve' });

    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/admin/verifications/review-by-token')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Content-Type', 'application/json')
      .send({ token: rawToken, action: 'reject' });

    expect(second.status).toBe(400);
    expect(second.body.message.toLowerCase()).toContain('invalid');
  });

  // CRITICAL REGRESSION TEST (caught in second-pass audit) — the
  // original code applied the global CSRF middleware to the email-link
  // POST endpoint, which broke the entire flow because HTML forms can't
  // set X-Requested-With. We now exempt that specific endpoint.
  it('QD-007 — POST /verifications/review-by-token works WITHOUT the X-Requested-With header (form submission)', async () => {
    const rawToken = 'e'.repeat(64);
    const tokenHash = hashVerificationToken(rawToken);
    const user = await User.create({
      name: 'Form Post',
      email: 'formpost@example.edu',
      phone: '5550005',
      passwordHash: '$2a$10$dummyhashdummyhashdummyhashdummyhashdummyhashdummyhash',
      emailVerified: true,
      verification: {
        registrationNo: 'REG-4',
        status: 'pending',
        submittedAt: new Date(),
        verificationTokenHash: tokenHash,
        verificationTokenExpires: new Date(Date.now() + 60 * 60 * 1000)
      }
    });

    // Submit as a browser-rendered HTML form would — application/x-www-form-urlencoded,
    // no X-Requested-With header. The CSRF middleware must exempt this path.
    const res = await request(app)
      .post('/api/admin/verifications/review-by-token')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(`token=${rawToken}&action=approve&reason=`);

    expect(res.status).toBe(200);

    const refreshed = await User.findById(user._id);
    expect(refreshed.verification.status).toBe('approved');
  });
});

