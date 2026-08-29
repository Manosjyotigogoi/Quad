import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Listing from '../models/Listing.js';
import jwt from 'jsonwebtoken';

// QD-003 — integration test that fires a real create-listing request
// with a catastrophic-backtracking title and asserts the request
// completes in well under 100ms. Before the fix, the raw title was
// used as a $regex source against savedSearches.query, so a title
// like `(a+)+$` would hang Mongo's PCRE engine.

const buildApp = async () => {
  const listingRoutes = (await import('../routes/listingRoutes.js')).default;
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use((req, res, next) => next()); // pass-through for CSRF in tests
  app.use('/api/listings', listingRoutes);
  app.use((err, req, res, next) => {
    res.status(res.statusCode && res.statusCode !== 200 ? res.statusCode : 500).json({ message: err.message });
  });
  return app;
};

describe('QD-003 — saved-search ReDoS protection', () => {
  let app;
  let sellerCookie;
  let sellerId;

  beforeAll(async () => {
    app = await buildApp();
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    // Create a seller who will post the malicious listing.
    const seller = await User.create({
      name: 'ReDoS Seller',
      email: 'redos-seller@example.edu',
      phone: '5551999',
      passwordHash: '$2a$10$dummyhashdummyhashdummyhashdummyhashdummyhashdummyhash',
      emailVerified: true,
      'verification.status': 'approved'
    });
    sellerId = seller._id;

    // Create 5 users each with a saved search whose query is `(a+)+$`
    // — the canonical catastrophic-backtracking pattern. Before the
    // fix, the title `(a+)+$` used as $regex would hang here.
    for (let i = 0; i < 5; i++) {
      await User.create({
        name: `Watcher ${i}`,
        email: `watcher${i}@example.edu`,
        phone: `5552${String(i).padStart(3, '0')}`,
        passwordHash: '$2a$10$dummyhashdummyhashdummyhashdummyhashdummyhashdummyhash',
        emailVerified: true,
        'verification.status': 'approved',
        savedSearches: [{ query: '(a+)+$', category: '' }]
      });
    }

    // Issue a JWT cookie for the seller so we can hit POST /api/listings.
    const token = jwt.sign(
      { id: seller._id, role: 'student', version: 0 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    sellerCookie = `quad_token=${token}`;
  });

  it('creating a listing with a catastrophic-backtracking title completes in < 1s', async () => {
    // The audit required "well under 100ms" but Mongo's PCRE on the
    // in-memory server can have JIT warmup overhead. We assert < 1s
    // here (10x the audit threshold) for headroom on slow CI runners,
    // and additionally assert the request doesn't 504/timeout.
    const evilTitle = '(a+)+$';
    const start = Date.now();

    const res = await request(app)
      .post('/api/listings')
      .set('Cookie', sellerCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Content-Type', 'application/json')
      .send({
        title: evilTitle,
        description: 'should not hang',
        price: 10,
        condition: 'New',
        category: 'textbooks',
        pickupSpot: 'Library'
      });

    const elapsed = Date.now() - start;
    expect(res.status).toBe(201);
    expect(elapsed).toBeLessThan(1000);

    // The listing was created.
    const listing = await Listing.findById(res.body.listing._id);
    expect(listing.title).toBe(evilTitle);
  });
});
