import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Listing from '../models/Listing.js';
import Order from '../models/Order.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import jwt from 'jsonwebtoken';

// QD-008 (price validation), QD-009 (empty-cart checkout), QD-011 (ObjectId guards),
// QD-024 (pagination), QD-025 (denormalized verificationStatus).

const buildListingsApp = async () => {
  const listingRoutes = (await import('../routes/listingRoutes.js')).default;
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use((req, res, next) => next());
  app.use('/api/listings', listingRoutes);
  app.use((err, req, res, next) => {
    res.status(res.statusCode && res.statusCode !== 200 ? res.statusCode : 500).json({ message: err.message });
  });
  return app;
};

const buildOrdersApp = async () => {
  const orderRoutes = (await import('../routes/orderRoutes.js')).default;
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use((req, res, next) => next());
  app.use('/api/orders', orderRoutes);
  app.use((err, req, res, next) => {
    res.status(res.statusCode && res.statusCode !== 200 ? res.statusCode : 500).json({ message: err.message });
  });
  return app;
};

const buildMessagesApp = async () => {
  const messageRoutes = (await import('../routes/messageRoutes.js')).default;
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use((req, res, next) => next());
  app.use('/api/messages', messageRoutes);
  app.use((err, req, res, next) => {
    res.status(res.statusCode && res.statusCode !== 200 ? res.statusCode : 500).json({ message: err.message });
  });
  return app;
};

const signCookie = (user) => {
  const token = jwt.sign(
    { id: user._id, role: user.role, version: user.tokenVersion ?? 0 },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  return `quad_token=${token}`;
};

describe('QD-008 — minPrice/maxPrice validation', () => {
  let app;

  beforeAll(async () => {
    app = await buildListingsApp();
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  it('rejects non-numeric minPrice with 400', async () => {
    const res = await request(app).get('/api/listings?minPrice=abc');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/minPrice/i);
  });

  it('rejects negative minPrice with 400', async () => {
    const res = await request(app).get('/api/listings?minPrice=-5');
    expect(res.status).toBe(400);
  });

  it('rejects malformed maxPrice with 400', async () => {
    const res = await request(app).get('/api/listings?maxPrice=1.2.3');
    expect(res.status).toBe(400);
  });

  it('accepts valid numeric minPrice and maxPrice', async () => {
    const res = await request(app).get('/api/listings?minPrice=10&maxPrice=100');
    expect(res.status).toBe(200);
  });
});

describe('QD-009 — empty-cart checkout returns 400', () => {
  let app;

  beforeAll(async () => {
    app = await buildOrdersApp();
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  it('returns 400 (not 201) when the user has no cart', async () => {
    const buyer = await User.create({
      name: 'QD009 Buyer',
      email: 'qd009-buyer@example.edu',
      phone: '5559001',
      passwordHash: 'x',
      emailVerified: true,
      'verification.status': 'approved',
      tokenVersion: 0
    });
    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', signCookie(buyer))
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Content-Type', 'application/json')
      .send({ deliveryLocation: 'Library', deliveryTime: new Date(Date.now() + 86400000).toISOString() });

    expect(res.status).toBe(400);
    expect(res.body.message.toLowerCase()).toContain('cart');
    expect(res.body.message).not.toContain('undefined');
  });
});

describe('QD-011 — ObjectId guards', () => {
  let listingsApp, ordersApp, reviewsApp;

  beforeAll(async () => {
    listingsApp = await buildListingsApp();
    ordersApp = await buildOrdersApp();
    const reviewRoutes = (await import('../routes/reviewRoutes.js')).default;
    reviewsApp = express();
    reviewsApp.use(express.json());
    reviewsApp.use(cookieParser());
    reviewsApp.use((req, res, next) => next());
    reviewsApp.use('/api/reviews', reviewRoutes);
    reviewsApp.use((err, req, res, next) => {
      res.status(res.statusCode && res.statusCode !== 200 ? res.statusCode : 500).json({ message: err.message });
    });
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  it('GET /api/listings/not-a-valid-id returns 400 (not 500)', async () => {
    const res = await request(listingsApp).get('/api/listings/not-a-valid-id');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/ObjectId/i);
  });

  it('POST /api/orders/not-a-valid-id/accept returns 400', async () => {
    const user = await User.create({
      name: 'QD011 User',
      email: 'qd011-user@example.edu',
      phone: '5559101',
      passwordHash: 'x',
      emailVerified: true,
      'verification.status': 'approved',
      tokenVersion: 0
    });
    const res = await request(ordersApp)
      .patch('/api/orders/not-a-valid-id/accept')
      .set('Cookie', signCookie(user))
      .set('X-Requested-With', 'XMLHttpRequest')
      .send();
    expect(res.status).toBe(400);
  });

  it('POST /api/reviews with malformed listingId returns 400', async () => {
    const user = await User.create({
      name: 'QD011b User',
      email: 'qd011b-user@example.edu',
      phone: '5559102',
      passwordHash: 'x',
      emailVerified: true,
      'verification.status': 'approved',
      tokenVersion: 0
    });
    const res = await request(reviewsApp)
      .post('/api/reviews')
      .set('Cookie', signCookie(user))
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Content-Type', 'application/json')
      .send({ listingId: 'malformed-id', rating: 5, body: 'Great' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/ObjectId/i);
  });
});

describe('QD-024 — pagination', () => {
  let ordersApp, messagesApp;

  beforeAll(async () => {
    ordersApp = await buildOrdersApp();
    messagesApp = await buildMessagesApp();
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  it('GET /api/orders/mine returns paginated response with total/page/pages', async () => {
    const buyer = await User.create({
      name: 'QD024 Buyer',
      email: 'qd024-buyer@example.edu',
      phone: '5559201',
      passwordHash: 'x',
      emailVerified: true,
      'verification.status': 'approved',
      tokenVersion: 0
    });
    const seller = await User.create({
      name: 'QD024 Seller',
      email: 'qd024-seller@example.edu',
      phone: '5559202',
      passwordHash: 'x',
      emailVerified: true,
      'verification.status': 'approved',
      tokenVersion: 0
    });

    // Seed 3 orders.
    for (let i = 0; i < 3; i++) {
      await Order.create({
        buyer: buyer._id,
        seller: seller._id,
        items: [],
        deliveryLocation: 'Library',
        deliveryTime: new Date(Date.now() + 86400000),
        status: 'pending'
      });
    }
    const res = await request(ordersApp)
      .get('/api/orders/mine?page=1&limit=2')
      .set('Cookie', signCookie(buyer));
    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(2);
    expect(res.body.total).toBeGreaterThanOrEqual(3);
    expect(res.body.page).toBe(1);
    expect(res.body.pages).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/messages/conversations returns paginated response', async () => {
    const buyer = await User.create({
      name: 'QD024b Buyer',
      email: 'qd024b-buyer@example.edu',
      phone: '5559203',
      passwordHash: 'x',
      emailVerified: true,
      'verification.status': 'approved',
      tokenVersion: 0
    });

    // Seed 3 conversations.
    for (let i = 0; i < 3; i++) {
      const other = await User.create({
        name: `Conv${i}`,
        email: `qd024b-c${i}@example.edu`,
        phone: `555922${i}`,
        passwordHash: 'x',
        emailVerified: true,
        'verification.status': 'approved',
        tokenVersion: 0
      });
      await Conversation.create({ participants: [buyer._id, other._id] });
    }
    const res = await request(messagesApp)
      .get('/api/messages/conversations?page=1&limit=2')
      .set('Cookie', signCookie(buyer));
    expect(res.status).toBe(200);
    expect(res.body.conversations).toHaveLength(2);
    expect(res.body.total).toBeGreaterThanOrEqual(3);
    expect(res.body.pages).toBeGreaterThanOrEqual(2);
  });
});

describe('QD-025 — denormalized verificationStatus filter', () => {
  let listingsApp;

  beforeAll(async () => {
    listingsApp = await buildListingsApp();
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  it('verifiedOnly=true returns only listings with verificationStatus=approved', async () => {
    const approvedSeller = await User.create({
      name: 'Approved Seller',
      email: 'qd025-approve@example.edu',
      phone: '5559301',
      passwordHash: 'x',
      emailVerified: true,
      'verification.status': 'approved',
      tokenVersion: 0
    });
    const pendingSeller = await User.create({
      name: 'Pending Seller',
      email: 'qd025-pending@example.edu',
      phone: '5559302',
      passwordHash: 'x',
      emailVerified: true,
      'verification.status': 'pending',
      tokenVersion: 0
    });
    await Listing.create({
      title: 'From approved seller',
      description: '',
      price: 10,
      condition: 'New',
      category: 'textbooks',
      pickupSpot: 'Library',
      quantity: 1,
      seller: approvedSeller._id,
      verificationStatus: 'approved'
    });
    await Listing.create({
      title: 'From pending seller',
      description: '',
      price: 10,
      condition: 'New',
      category: 'textbooks',
      pickupSpot: 'Library',
      quantity: 1,
      seller: pendingSeller._id,
      verificationStatus: 'pending'
    });

    const res = await request(listingsApp).get('/api/listings?verifiedOnly=true');
    expect(res.status).toBe(200);
    expect(res.body.listings.length).toBeGreaterThanOrEqual(1);
    // Every returned listing must be from an approved seller.
    for (const l of res.body.listings) {
      expect(l.verificationStatus || 'approved').toBe('approved');
    }
  });
});

describe('QD-012 — enumeration oracle fixes', () => {
  let app;

  beforeAll(async () => {
    app = await (async () => {
      const authRoutes = (await import('../routes/authRoutes.js')).default;
      const a = express();
      a.use(express.json());
      a.use(cookieParser());
      a.use((req, res, next) => next());
      a.use('/api/auth', authRoutes);
      a.use((err, req, res, next) => {
        res.status(res.statusCode && res.statusCode !== 200 ? res.statusCode : 500).json({ message: err.message });
      });
      return a;
    })();
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  it('register returns 201 even when email is a duplicate', async () => {
    const payload = {
      name: 'QD012 User',
      email: 'qd012-dup@example.edu',
      phone: '5559401',
      password: 'password123'
    };
    const first = await request(app)
      .post('/api/auth/register')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Content-Type', 'application/json')
      .send(payload);
    expect(first.status).toBe(201);

    // Second registration with the SAME email — must also return 201,
    // NOT 409, so an attacker can't probe which emails exist.
    const second = await request(app)
      .post('/api/auth/register')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Content-Type', 'application/json')
      .send(payload);
    expect(second.status).toBe(201);
    expect(second.body.message).toBe(first.body.message);
  });

  it('verify-otp returns the same error message for non-existent vs. wrong OTP', async () => {
    // Non-existent email.
    const r1 = await request(app)
      .post('/api/auth/verify-otp')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Content-Type', 'application/json')
      .send({ email: 'nonexistent@example.edu', otp: '123456' });
    expect(r1.status).toBe(400);

    // Wrong OTP on an existing user.
    const user = await User.create({
      name: 'QD012b User',
      email: 'qd012b@example.edu',
      phone: '5559402',
      passwordHash: 'x',
      emailVerified: false,
      tokenVersion: 0
    });
    user.otpHash = 'fakehash'.repeat(8);
    user.otpExpires = new Date(Date.now() + 60 * 60 * 1000);
    user.otpAttempts = 0;
    await user.save();
    const r2 = await request(app)
      .post('/api/auth/verify-otp')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Content-Type', 'application/json')
      .send({ email: 'qd012b@example.edu', otp: '000000' });
    expect(r2.status).toBe(400);

    // The two error messages must be IDENTICAL.
    expect(r1.body.message).toBe(r2.body.message);
  });

  it('verify-otp does NOT reveal remaining attempts', async () => {
    const user = await User.create({
      name: 'QD012c User',
      email: 'qd012c@example.edu',
      phone: '5559403',
      passwordHash: 'x',
      emailVerified: false,
      tokenVersion: 0
    });
    user.otpHash = 'fakehash'.repeat(8);
    user.otpExpires = new Date(Date.now() + 60 * 60 * 1000);
    user.otpAttempts = 0;
    await user.save();

    const r = await request(app)
      .post('/api/auth/verify-otp')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Content-Type', 'application/json')
      .send({ email: 'qd012c@example.edu', otp: '000000' });

    expect(r.status).toBe(400);
    expect(r.body.message.toLowerCase()).not.toContain('attempt');
    expect(r.body.message.toLowerCase()).not.toContain('left');
  });
});
