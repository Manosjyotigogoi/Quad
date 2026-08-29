import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';

// QD-001 guard — require()'ing every model file must not throw.
//
// Round 2 audit found that `User.js` declared `_id: true` on a subdocument
// array, which throws `TypeError: Invalid schema configuration: 'True' is
// not a valid type` at schema-compilation under Mongoose 8.24.x. Because
// `server.js` only imports models lazily via route handlers, the bug was
// invisible until a route actually loaded the model — by which point the
// process had already crashed on boot in production.
//
// This file imports every model up-front so any future schema-config bug
// fails the test run instead of shipping silently.

describe('Mongoose models compile cleanly (QD-001 regression guard)', () => {
  it('User model compiles', async () => {
    const mod = await import('../models/User.js');
    expect(mod.default).toBeDefined();
    expect(mod.default.modelName).toBe('User');
  });

  it('Listing model compiles', async () => {
    const mod = await import('../models/Listing.js');
    expect(mod.default).toBeDefined();
    expect(mod.default.modelName).toBe('Listing');
  });

  it('Order model compiles', async () => {
    const mod = await import('../models/Order.js');
    expect(mod.default).toBeDefined();
    expect(mod.default.modelName).toBe('Order');
  });

  it('Cart model compiles', async () => {
    const mod = await import('../models/Cart.js');
    expect(mod.default).toBeDefined();
    expect(mod.default.modelName).toBe('Cart');
  });

  it('Review model compiles', async () => {
    const mod = await import('../models/Review.js');
    expect(mod.default).toBeDefined();
    expect(mod.default.modelName).toBe('Review');
  });

  it('Message model compiles', async () => {
    const mod = await import('../models/Message.js');
    expect(mod.default).toBeDefined();
    expect(mod.default.modelName).toBe('Message');
  });

  it('Conversation model compiles', async () => {
    const mod = await import('../models/Conversation.js');
    expect(mod.default).toBeDefined();
    expect(mod.default.modelName).toBe('Conversation');
  });

  it('Category model compiles', async () => {
    const mod = await import('../models/Category.js');
    expect(mod.default).toBeDefined();
    expect(mod.default.modelName).toBe('Category');
  });

  it('AuditLog model compiles (added by QD-015)', async () => {
    const mod = await import('../models/AuditLog.js');
    expect(mod.default).toBeDefined();
    expect(mod.default.modelName).toBe('AuditLog');
  });

  it('Notification model compiles (added by QD-026)', async () => {
    const mod = await import('../models/Notification.js');
    expect(mod.default).toBeDefined();
    expect(mod.default.modelName).toBe('Notification');
  });

  it('mongoose is connected-ready (no schema errors pending)', () => {
    // The fact that we got here without throwing means every import above
    // resolved and called mongoose.model() successfully.
    expect(mongoose.models.User).toBeDefined();
    expect(mongoose.models.Listing).toBeDefined();
    expect(mongoose.models.Order).toBeDefined();
    expect(mongoose.models.Cart).toBeDefined();
    expect(mongoose.models.Review).toBeDefined();
    expect(mongoose.models.Message).toBeDefined();
    expect(mongoose.models.Conversation).toBeDefined();
    expect(mongoose.models.Category).toBeDefined();
  });
});
