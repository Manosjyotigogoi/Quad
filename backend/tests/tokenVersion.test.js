import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';

// QD-004 — session invalidation test.
//
// Flow:
// 1. Create a verified user (plaintext password, let the pre-save hook hash it).
// 2. Issue a JWT for them (version 0).
// 3. Sanity-check: old cookie works.
// 4. Reset their password — bumps tokenVersion to 1.
// 5. Replay the OLD cookie (version 0) against /api/auth/me — expect 401.
//
// And:
// 6. Logged-in user changes password via /change-password — old cookie
//    rejected, new cookie (set in response) works.

const buildApp = async () => {
  const authRoutes = (await import('../routes/authRoutes.js')).default;
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use((req, res, next) => next()); // CSRF stub
  app.use('/api/auth', authRoutes);
  app.use((err, req, res, next) => {
    res.status(res.statusCode && res.statusCode !== 200 ? res.statusCode : 500).json({ message: err.message });
  });
  return app;
};

const signCookie = (user, version) => {
  const token = jwt.sign(
    { id: user._id, role: user.role, version: version ?? 0 },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  return `quad_token=${token}`;
};

describe('QD-004 — session invalidation on password reset / change', () => {
  let app;

  beforeAll(async () => {
    app = await buildApp();
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  it('an old cookie is rejected after password reset', async () => {
    // Seed a verified user — use a real plaintext password so the
    // pre-save hook hashes it the normal way. We then set the
    // resetTokenHash/Expires manually so /reset-password accepts a
    // known raw token.
    const user = await User.create({
      name: 'Reset Me',
      email: 'resetme@example.edu',
      phone: '5552001',
      passwordHash: 'oldpass123',
      emailVerified: true,
      'verification.status': 'approved',
      tokenVersion: 0
    });

    // Set up the reset token: rawToken='test-raw-token', hash=sha256('test-raw-token').
    // We can't easily compute this without the helper, so just import it.
    const { hashResetToken } = await import('../utils/passwordResetToken.js');
    const rawToken = 'test-raw-reset-token-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    user.resetTokenHash = hashResetToken(rawToken);
    user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const oldCookie = signCookie(user, 0);

    // Sanity: old cookie works before reset.
    const before = await request(app)
      .get('/api/auth/me')
      .set('Cookie', oldCookie);
    expect(before.status).toBe(200);

    // Reset password via the endpoint — should bump tokenVersion.
    const reset = await request(app)
      .post('/api/auth/reset-password')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Content-Type', 'application/json')
      .send({ token: rawToken, password: 'newpass123' });

    expect(reset.status).toBe(200);

    // Verify tokenVersion was bumped.
    const refreshed = await User.findById(user._id).select('+tokenVersion');
    expect(refreshed.tokenVersion).toBe(1);

    // Replay the OLD cookie — protect() must reject because decoded.version (0) !== user.tokenVersion (1).
    const after = await request(app)
      .get('/api/auth/me')
      .set('Cookie', oldCookie);
    expect(after.status).toBe(401);
    expect(after.body.message.toLowerCase()).toContain('session');
  });

  // CRITICAL REGRESSION TEST (caught in second-pass audit) — the
  // original code was missing `+tokenVersion` from the .select() in
  // resetPassword. Because tokenVersion is select:false, the loaded
  // user had tokenVersion === undefined, and the bump line evaluated
  // as (undefined || 0) + 1 = 1 every time. So the SECOND reset
  // didn't actually bump — any cookie from after the FIRST reset
  // stayed valid forever.
  it('a SECOND password reset bumps tokenVersion to 2 (not back to 1)', async () => {
    const { hashResetToken, generateResetToken } = await import('../utils/passwordResetToken.js');

    // Seed a user whose tokenVersion is already 1 (i.e. has reset
    // their password once before).
    const user = await User.create({
      name: 'Reset Twice',
      email: 'reset2@example.edu',
      phone: '5552099',
      passwordHash: 'oldpass123',
      emailVerified: true,
      'verification.status': 'approved',
      tokenVersion: 1
    });

    // Issue a fresh reset token.
    const { rawToken, tokenHash } = generateResetToken();
    user.resetTokenHash = tokenHash;
    user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    // Issue a cookie with version=1 (the current value) — this should
    // work BEFORE the second reset.
    const cookieBeforeSecondReset = signCookie(user, 1);

    // Perform the second reset.
    const reset = await request(app)
      .post('/api/auth/reset-password')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Content-Type', 'application/json')
      .send({ token: rawToken, password: 'newpass456' });

    expect(reset.status).toBe(200);

    // CRITICAL ASSERTION — tokenVersion must now be 2, not 1.
    const refreshed = await User.findById(user._id).select('+tokenVersion');
    expect(refreshed.tokenVersion).toBe(2);

    // The cookie that worked BEFORE the second reset (version=1)
    // must now be REJECTED.
    const replay = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookieBeforeSecondReset);
    expect(replay.status).toBe(401);
  });

  it('an old cookie is rejected after change-password; new cookie works', async () => {
    const user = await User.create({
      name: 'Change Me',
      email: 'changeme@example.edu',
      phone: '5552002',
      passwordHash: 'changeme123',
      emailVerified: true,
      'verification.status': 'approved',
      tokenVersion: 0
    });

    const oldCookie = signCookie(user, 0);

    // Hit the change-password endpoint with the old cookie.
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', oldCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Content-Type', 'application/json')
      .send({ currentPassword: 'changeme123', newPassword: 'newpass456' });

    expect(res.status).toBe(200);

    // The new cookie (set in the response) should work; the old one
    // should NOT.
    const setCookieHeader = res.headers['set-cookie'];
    expect(setCookieHeader).toBeDefined();
    const newCookieStr = Array.isArray(setCookieHeader)
      ? setCookieHeader.find((c) => c.startsWith('quad_token='))
      : setCookieHeader;
    expect(newCookieStr).toBeDefined();

    // Old cookie should now be rejected.
    const after = await request(app)
      .get('/api/auth/me')
      .set('Cookie', oldCookie);
    expect(after.status).toBe(401);

    // New cookie should work — supertest takes the full Set-Cookie value
    // (including attributes); we need to extract just the cookie name=value
    // part to replay it.
    const newCookie = newCookieStr.split(';')[0];
    const after2 = await request(app)
      .get('/api/auth/me')
      .set('Cookie', newCookie);
    expect(after2.status).toBe(200);
  });
});
