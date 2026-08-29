import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Listing from '../models/Listing.js';
import Order from '../models/Order.js';
import jwt from 'jsonwebtoken';

// QD-005 — Concurrency test: two simultaneous accepts on a quantity:1
// listing. Exactly one must succeed (200), the other must fail (409).
//
// QD-006 — Cancel-restores-stock test: an accepted order is cancelled
// by the buyer; the listing's quantity must return to its pre-accept
// value AND the listing status must be flipped back to 'active' if it
// had been 'sold'.
//
// Both tests use real JWT cookies signed with the test JWT_SECRET. The
// protect middleware runs normally — it's the actual production code
// path we want to test.

const buildApp = async () => {
  const orderRoutes = (await import('../routes/orderRoutes.js')).default;
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use((req, res, next) => next()); // CSRF stub
  app.use('/api/orders', orderRoutes);
  app.use((err, req, res, next) => {
    res.status(res.statusCode && res.statusCode !== 200 ? res.statusCode : 500).json({ message: err.message });
  });
  return app;
};

const signCookie = (user, version = 0) => {
  const token = jwt.sign(
    { id: user._id, role: user.role, version },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  return `quad_token=${token}`;
};

describe('QD-005 — atomic stock decrement under concurrent accepts', () => {
  let app;

  beforeAll(async () => {
    app = await buildApp();
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  it('two concurrent accepts on a quantity:1 listing — exactly one wins', async () => {
    const seller = await User.create({
      name: 'QD005 Seller',
      email: 'qd005-seller@example.edu',
      phone: '5553000',
      passwordHash: 'irrelevant-but-needed',
      emailVerified: true,
      'verification.status': 'approved',
      tokenVersion: 0
    });
    const sellerCookie = signCookie(seller);

    const listing = await Listing.create({
      title: 'QD005 Item',
      description: '',
      price: 10,
      condition: 'New',
      category: 'textbooks',
      pickupSpot: 'Library',
      quantity: 1,
      seller: seller._id
    });

    const buyer1 = await User.create({
      name: 'QD005 Buyer1',
      email: 'qd005-b1@example.edu',
      phone: '5553001',
      passwordHash: 'x',
      emailVerified: true,
      'verification.status': 'approved',
      tokenVersion: 0
    });
    const buyer2 = await User.create({
      name: 'QD005 Buyer2',
      email: 'qd005-b2@example.edu',
      phone: '5553002',
      passwordHash: 'x',
      emailVerified: true,
      'verification.status': 'approved',
      tokenVersion: 0
    });

    const o1 = await Order.create({
      buyer: buyer1._id,
      seller: seller._id,
      items: [{ listing: listing._id, title: 'QD005 Item', price: 10, quantity: 1 }],
      deliveryLocation: 'Library',
      deliveryTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'pending'
    });
    const o2 = await Order.create({
      buyer: buyer2._id,
      seller: seller._id,
      items: [{ listing: listing._id, title: 'QD005 Item', price: 10, quantity: 1 }],
      deliveryLocation: 'Library',
      deliveryTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'pending'
    });

    // Fire two accepts concurrently as the seller.
    const [r1, r2] = await Promise.all([
      request(app)
        .patch(`/api/orders/${o1._id}/accept`)
        .set('Cookie', sellerCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send(),
      request(app)
        .patch(`/api/orders/${o2._id}/accept`)
        .set('Cookie', sellerCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send()
    ]);

    const codes = [r1.status, r2.status].sort();
    // Exactly one must succeed, the other must fail with 409.
    // (401 would indicate a cookie/CSRF/auth problem with the test
    // setup itself, NOT a stock-concurrency failure.)
    expect([200, 409]).toContain(r1.status);
    expect([200, 409]).toContain(r2.status);
    expect(codes).toEqual([200, 409]);

    // Final listing state: quantity 0, status 'sold'.
    const refreshed = await Listing.findById(listing._id);
    expect(refreshed.quantity).toBe(0);
    expect(refreshed.status).toBe('sold');
  });

  // CRITICAL REGRESSION TEST (caught in second-pass audit) — the
  // original acceptOrder had a TOCTOU on `order.status`: it read the
  // status non-atomically via `findPendingOrderForSeller`, both
  // concurrent calls passed the `status !== 'pending'` check, both
  // decremented stock, both saved the order as accepted. With our
  // findOneAndUpdate-based atomic transition, exactly one wins.
  it('two concurrent accepts on the SAME order — exactly one wins', async () => {
    const seller = await User.create({
      name: 'QD005c Seller',
      email: 'qd005c-seller@example.edu',
      phone: '5553010',
      passwordHash: 'x',
      emailVerified: true,
      'verification.status': 'approved',
      tokenVersion: 0
    });
    const sellerCookie = signCookie(seller);

    const buyer = await User.create({
      name: 'QD005c Buyer',
      email: 'qd005c-buyer@example.edu',
      phone: '5553011',
      passwordHash: 'x',
      emailVerified: true,
      'verification.status': 'approved',
      tokenVersion: 0
    });

    // Listing with quantity:5 — enough stock for two concurrent accepts
    // if the order-status guard isn't atomic.
    const listing = await Listing.create({
      title: 'QD005c Item',
      description: '',
      price: 10,
      condition: 'New',
      category: 'textbooks',
      pickupSpot: 'Library',
      quantity: 5,
      seller: seller._id
    });

    const order = await Order.create({
      buyer: buyer._id,
      seller: seller._id,
      items: [{ listing: listing._id, title: 'QD005c Item', price: 10, quantity: 1 }],
      deliveryLocation: 'Library',
      deliveryTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'pending'
    });

    // Fire two concurrent accepts on the SAME order.
    const [r1, r2] = await Promise.all([
      request(app)
        .patch(`/api/orders/${order._id}/accept`)
        .set('Cookie', sellerCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send(),
      request(app)
        .patch(`/api/orders/${order._id}/accept`)
        .set('Cookie', sellerCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send()
    ]);

    // Exactly one must succeed, the other must fail (400 — "already
    // responded to"). NOT both 200 — that would mean stock was
    // double-decremented for a single order.
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([200, 400]);

    // Listing must be decremented exactly ONCE (5 → 4), not twice (5 → 3).
    const finalListing = await Listing.findById(listing._id);
    expect(finalListing.quantity).toBe(4);
  });
});

describe('QD-006 — cancelled accepted order restores stock', () => {
  let app;

  beforeAll(async () => {
    app = await buildApp();
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  it('buyer cancels an accepted order → listing quantity restored + status active', async () => {
    const seller = await User.create({
      name: 'QD006 Seller',
      email: 'qd006-seller@example.edu',
      phone: '5554000',
      passwordHash: 'x',
      emailVerified: true,
      'verification.status': 'approved',
      tokenVersion: 0
    });
    const sellerCookie = signCookie(seller);

    const buyer = await User.create({
      name: 'QD006 Buyer',
      email: 'qd006-buyer@example.edu',
      phone: '5554001',
      passwordHash: 'x',
      emailVerified: true,
      'verification.status': 'approved',
      tokenVersion: 0
    });
    const buyerCookie = signCookie(buyer);

    const listing = await Listing.create({
      title: 'QD006 Item',
      description: '',
      price: 10,
      condition: 'New',
      category: 'textbooks',
      pickupSpot: 'Library',
      quantity: 1,
      seller: seller._id
    });

    const order = await Order.create({
      buyer: buyer._id,
      seller: seller._id,
      items: [{ listing: listing._id, title: 'QD006 Item', price: 10, quantity: 1 }],
      deliveryLocation: 'Library',
      deliveryTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'pending'
    });

    // Seller accepts.
    const accept = await request(app)
      .patch(`/api/orders/${order._id}/accept`)
      .set('Cookie', sellerCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send();
    expect(accept.status).toBe(200);

    // Listing is now sold.
    const afterAccept = await Listing.findById(listing._id);
    expect(afterAccept.quantity).toBe(0);
    expect(afterAccept.status).toBe('sold');

    // Buyer cancels.
    const cancel = await request(app)
      .delete(`/api/orders/${order._id}`)
      .set('Cookie', buyerCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send();
    expect(cancel.status).toBe(200);

    // Listing is now active again with quantity 1.
    const afterCancel = await Listing.findById(listing._id);
    expect(afterCancel.quantity).toBe(1);
    expect(afterCancel.status).toBe('active');

    // Order is cancelled.
    const refreshed = await Order.findById(order._id);
    expect(refreshed.status).toBe('cancelled');
  });

  it('buyer cancels a pending order (not yet accepted) — stock unchanged', async () => {
    const seller = await User.create({
      name: 'QD006b Seller',
      email: 'qd006b-seller@example.edu',
      phone: '5554002',
      passwordHash: 'x',
      emailVerified: true,
      'verification.status': 'approved',
      tokenVersion: 0
    });

    const buyer = await User.create({
      name: 'QD006b Buyer',
      email: 'qd006b-buyer@example.edu',
      phone: '5554003',
      passwordHash: 'x',
      emailVerified: true,
      'verification.status': 'approved',
      tokenVersion: 0
    });
    const buyerCookie = signCookie(buyer);

    const listing = await Listing.create({
      title: 'QD006b Item',
      description: '',
      price: 10,
      condition: 'New',
      category: 'textbooks',
      pickupSpot: 'Library',
      quantity: 2,
      seller: seller._id
    });

    const order = await Order.create({
      buyer: buyer._id,
      seller: seller._id,
      items: [{ listing: listing._id, title: 'QD006b Item', price: 10, quantity: 1 }],
      deliveryLocation: 'Library',
      deliveryTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'pending'
    });

    const beforeQty = (await Listing.findById(listing._id)).quantity;

    const cancel = await request(app)
      .delete(`/api/orders/${order._id}`)
      .set('Cookie', buyerCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send();
    expect(cancel.status).toBe(200);

    // Quantity unchanged (was never decremented).
    const afterQty = (await Listing.findById(listing._id)).quantity;
    expect(afterQty).toBe(beforeQty);
  });
});
