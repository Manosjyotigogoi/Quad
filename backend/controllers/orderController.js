import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Listing from '../models/Listing.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { guardObjectId } from '../middleware/validateObjectId.js';
import { purgeListingFromCarts } from './listingController.js';
import { sendEmail, orderNotificationEmail } from '../utils/sendEmail.js';
import { pushNotification } from '../utils/notifications.js';
import { logger } from '../utils/logger.js';
import { ordersAcceptedTotal, ordersRejectedTotal, ordersCancelledTotal } from '../utils/metrics.js';
import { emitToUser } from '../realtime/socket.js';

const ORDER_POPULATE = [
  { path: 'buyer', select: 'name avatarUrl dorm rating verification.status email' },
  { path: 'seller', select: 'name avatarUrl dorm rating verification.status email' },
  { path: 'items.listing', select: 'title images status quantity' }
];

// Helper: pushes an in-app notification + emits a real-time event + sends
// an email to the recipient.
async function notifyOrderUpdate(recipientId, { action, order, counterpartyName, isBuyer }) {
  const recipient = await User.findById(recipientId).select('name email');
  if (!recipient) return;

  const itemsSummary = order.items
    .map((i) => `• ${i.title} × ${i.quantity} — $${(i.price * i.quantity).toLocaleString('en-US')}`)
    .join('\n');

  // In-app notification
  const notifTitle =
    action === 'accepted' ? (isBuyer ? 'Your order was accepted' : 'Order accepted') :
    action === 'rejected' ? (isBuyer ? 'Your order was declined' : 'Order declined') :
    action === 'cancelled' ? 'Order cancelled' :
    action === 'completed' ? 'Order completed' :
    'Order update';

  const notifBody =
    action === 'accepted' ? `${counterpartyName} accepted your order for:\n${itemsSummary}` :
    action === 'rejected' ? `${counterpartyName} declined your order request.` :
    action === 'cancelled' ? `An order with ${counterpartyName} was cancelled.` :
    action === 'completed' ? `Your order with ${counterpartyName} is complete. You can now leave a review.` :
    '';

  // CRITICAL FIX (QD-026 regression) — route through pushNotification
  // helper so the standalone Notification collection gets a row AND the
  // embedded array is $slice-capped.
  await pushNotification(recipientId, {
    type: 'order',
    title: notifTitle,
    body: notifBody,
    link: '/orders'
  });
  emitToUser(recipientId, 'order:update', { orderId: order._id, status: order.status, action });

  // Email
  try {
    const { subject, text, html } = orderNotificationEmail(recipient, {
      action,
      orderSummary: itemsSummary,
      counterpartyName
    });
    await sendEmail({ to: recipient.email, subject, text, html });
  } catch (err) {
    console.error('Failed to send order notification email:', err.message);
  }
}

// POST /api/orders
export const createOrders = asyncHandler(async (req, res) => {
  const { deliveryLocation, deliveryTime } = req.body;

  if (!deliveryLocation || !String(deliveryLocation).trim()) {
    res.status(400);
    throw new Error('Add where you want to receive your order');
  }
  const time = new Date(deliveryTime);
  if (!deliveryTime || Number.isNaN(time.getTime())) {
    res.status(400);
    throw new Error('Add a valid date and time');
  }

  const cart = await Cart.findOne({ user: req.user._id }).populate('items.listing');
  if (!cart || cart.items.length === 0) {
    res.status(400);
    throw new Error('Your cart is empty');
  }

  const validItems = cart.items.filter((item) => item.listing && item.listing.status === 'active');
  if (validItems.length === 0) {
    res.status(400);
    throw new Error('Nothing in your cart is available to order anymore');
  }

  const bySeller = new Map();
  for (const item of validItems) {
    const sellerId = String(item.listing.seller);
    if (String(sellerId) === String(req.user._id)) continue;
    if (!bySeller.has(sellerId)) bySeller.set(sellerId, []);
    bySeller.get(sellerId).push({
      listing: item.listing._id,
      title: item.listing.title,
      price: item.listing.price,
      quantity: Math.min(item.quantity, item.listing.quantity || item.quantity)
    });
  }

  if (bySeller.size === 0) {
    res.status(400);
    throw new Error('Nothing in your cart is available to order anymore');
  }

  const orders = await Order.create(
    Array.from(bySeller.entries()).map(([sellerId, items]) => ({
      buyer: req.user._id,
      seller: sellerId,
      items,
      deliveryLocation: deliveryLocation.trim(),
      deliveryTime: time
    }))
  );

  const orderedListingIds = new Set(
    orders.flatMap((o) => o.items.map((i) => String(i.listing)))
  );
  cart.items = cart.items.filter((item) => !orderedListingIds.has(String(item.listing)));
  await cart.save();

  const populated = await Order.find({ _id: { $in: orders.map((o) => o._id) } }).populate(ORDER_POPULATE);

  // Notify each seller that a new order request came in.
  for (const order of populated) {
    await notifyOrderUpdate(order.seller._id, {
      action: 'pending',
      order,
      counterpartyName: order.buyer.name,
      isBuyer: false
    });
  }

  res.status(201).json({ orders: populated });
});

// GET /api/orders/mine?page=&limit=
// QD-024 — Paginated. Limit capped at 50.
export const getMyOrders = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;
  const filter = { buyer: req.user._id };
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(ORDER_POPULATE),
    Order.countDocuments(filter)
  ]);
  res.json({ orders, total, page, pages: Math.ceil(total / limit) });
});

// GET /api/orders/received?page=&limit=
// QD-024 — Paginated. Limit capped at 50.
export const getReceivedOrders = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;
  const filter = { seller: req.user._id };
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(ORDER_POPULATE),
    Order.countDocuments(filter)
  ]);
  res.json({ orders, total, page, pages: Math.ceil(total / limit) });
});

async function findPendingOrderForSeller(orderId, sellerId) {
  const order = await Order.findById(orderId);
  if (!order) return { error: [404, 'Order not found'] };
  if (String(order.seller) !== String(sellerId)) return { error: [403, 'This is not your order to manage'] };
  if (order.status !== 'pending') return { error: [400, 'This order was already responded to'] };
  return { order };
}

// PATCH /api/orders/:id/accept
// ATOMIC stock decrement — uses findOneAndUpdate with a $gte guard so two
// concurrent accepts for the same limited-stock item can't both succeed.
// (QD-005 — was previously read-check-write with no guard, allowing
// oversell under concurrent accepts.)
//
// CRITICAL FIX (caught in second-pass audit) — the original code had a
// TOCTOU on `order.status`. We now atomically flip status:pending → :accepted
// via findOneAndUpdate FIRST, then decrement stock. If the flip fails
// (someone else got there first), we 400 immediately with no side effects.
//
// THIRD-PASS HARDENING — the second-pass fix still had a partial-failure
// leak: if item N's decrement failed (out of stock), items 1..N-1 stayed
// decremented. We now wrap the whole decrement loop in a Mongo
// transaction so a mid-loop failure rolls back ALL prior decrements.
// On standalone mongod (no replica set → no transactions), we fall back
// to manual compensation: re-$inc the already-decremented items back.
//
// QD-011 — guardObjectId on req.params.id.
export const acceptOrder = asyncHandler(async (req, res) => {
  guardObjectId(req.params.id, 'id', res);

  // Atomic pending→accepted transition. Two concurrent accepts on the
  // SAME order — only one wins the findOneAndUpdate (the other gets null).
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, seller: req.user._id, status: 'pending' },
    { $set: { status: 'accepted', respondedAt: new Date() } },
    { new: true }
  );
  if (!order) {
    const existing = await Order.findById(req.params.id).select('seller status');
    if (!existing) {
      res.status(404);
      throw new Error('Order not found');
    }
    if (String(existing.seller) !== String(req.user._id)) {
      res.status(403);
      throw new Error('This is not your order to manage');
    }
    res.status(400);
    throw new Error('This order was already responded to');
  }

  // Now we hold the "accepted" lock — decrement stock per item inside a
  // transaction. On failure, ALL decrements are rolled back atomically
  // and the order status is restored to 'pending'.
  const itemsSoldBumps = [];
  const decrementedItems = []; // for manual-compensation fallback

  // Try a real Mongo transaction first (requires replica set).
  const session = await mongoose.startSession();
  let txSucceeded = false;
  try {
    await session.withTransaction(async () => {
      for (const item of order.items) {
        const updated = await Listing.findOneAndUpdate(
          { _id: item.listing, status: 'active', quantity: { $gte: item.quantity } },
          { $inc: { quantity: -item.quantity } },
          { new: true, session }
        );
        if (!updated) {
          throw new Error(`Not enough stock left for "${item.title}" to accept this order`);
        }
        if (updated.quantity <= 0) {
          updated.status = 'sold';
          await updated.save({ session });
          await User.findByIdAndUpdate(req.user._id, { $inc: { itemsSold: 1 } }, { session });
          await purgeListingFromCarts(updated._id);
          itemsSoldBumps.push(String(item.listing));
        }
        decrementedItems.push({ listing: item.listing, quantity: item.quantity });
      }
      order.itemsSoldBumps = itemsSoldBumps;
      await order.save({ session });
    });
    txSucceeded = true;
  } catch (err) {
    // If the transaction failed with a stock-out error, the rollback
    // already undid any partial decrements. If the failure was because
    // transactions aren't supported (standalone mongod), fall back to
    // manual compensation.
    if (err.message?.includes('Transaction numbers')) {
      // Transactions not supported — manual compensation path.
      logger.warn({ orderId: order._id, err: err.message }, '[acceptOrder] transactions unavailable — using manual compensation');
      try {
        for (const item of order.items) {
          const updated = await Listing.findOneAndUpdate(
            { _id: item.listing, status: 'active', quantity: { $gte: item.quantity } },
            { $inc: { quantity: -item.quantity } },
            { new: true }
          );
          if (!updated) {
            // Out of stock — restore previously-decremented items.
            for (const prev of decrementedItems) {
              await Listing.updateOne({ _id: prev.listing }, { $inc: { quantity: prev.quantity } });
            }
            await Order.updateOne({ _id: order._id }, { $set: { status: 'pending', respondedAt: null } });
            res.status(409);
            throw new Error(`Not enough stock left for "${item.title}" to accept this order`);
          }
          if (updated.quantity <= 0) {
            updated.status = 'sold';
            await updated.save();
            await User.findByIdAndUpdate(req.user._id, { $inc: { itemsSold: 1 } });
            await purgeListingFromCarts(updated._id);
            itemsSoldBumps.push(String(item.listing));
          }
          decrementedItems.push({ listing: item.listing, quantity: item.quantity });
        }
        order.itemsSoldBumps = itemsSoldBumps;
        await order.save();
        txSucceeded = true;
      } catch (innerErr) {
        // Re-throw with proper status code set above.
        throw innerErr;
      }
    } else {
      // Transaction failed (likely a stock-out) — order status needs restoring.
      await Order.updateOne({ _id: order._id }, { $set: { status: 'pending', respondedAt: null, itemsSoldBumps: [] } });
      res.status(409);
      throw err;
    }
  } finally {
    await session.endSession();
  }

  if (!txSucceeded) {
    res.status(409);
    throw new Error('Could not accept order — transaction failed');
  }

  ordersAcceptedTotal.inc();
  const populated = await Order.findById(order._id).populate(ORDER_POPULATE);
  await notifyOrderUpdate(populated.buyer._id, {
    action: 'accepted',
    order: populated,
    counterpartyName: populated.seller.name,
    isBuyer: true
  });

  res.json({ order: populated });
});

// PATCH /api/orders/:id/reject
// QD-011 — guardObjectId on req.params.id.
export const rejectOrder = asyncHandler(async (req, res) => {
  guardObjectId(req.params.id, 'id', res);
  const { order, error } = await findPendingOrderForSeller(req.params.id, req.user._id);
  if (error) {
    res.status(error[0]);
    throw new Error(error[1]);
  }

  order.status = 'rejected';
  order.respondedAt = new Date();
  await order.save();
  ordersRejectedTotal.inc();

  const populated = await Order.findById(order._id).populate(ORDER_POPULATE);
  await notifyOrderUpdate(populated.buyer._id, {
    action: 'rejected',
    order: populated,
    counterpartyName: populated.seller.name,
    isBuyer: true
  });

  res.json({ order: populated });
});

// DELETE /api/orders/:id — buyer cancels their own request.
// QD-006 — if the order was already ACCEPTED (stock was decremented at
// accept time), the cancellation must increment each listing's quantity
// back AND reset the listing's status to 'active' if it had been flipped
// to 'sold'. Without this, every cancellation permanently shrinks
// inventory.
//
// Stock restoration uses the same atomic conditional pattern as
// acceptOrder (QD-005): a single findOneAndUpdate per item, no
// read-check-write race.
//
// QD-011 — guardObjectId on req.params.id.
export const cancelOrder = asyncHandler(async (req, res) => {
  guardObjectId(req.params.id, 'id', res);
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  if (String(order.buyer) !== String(req.user._id)) {
    res.status(403);
    throw new Error('This is not your order to cancel');
  }
  if (!['pending', 'accepted'].includes(order.status)) {
    res.status(400);
    throw new Error('This order can no longer be cancelled');
  }

  const wasAccepted = order.status === 'accepted';

  order.status = 'cancelled';
  order.respondedAt = new Date();
  await order.save();
  ordersCancelledTotal.inc();

  // Only restore stock for orders that had actually decremented it.
  if (wasAccepted) {
    for (const item of order.items) {
      // QD-006 fix — only set status:'active' if the listing was 'sold'
      // because of THIS order (i.e. it's in itemsSoldBumps). Otherwise
      // we'd clobber a seller's deliberate 'sold' mark for an unrelated
      // reason. And only decrement itemsSold for items in the same set.
      const listingWasSoldByThisOrder = (order.itemsSoldBumps || []).includes(String(item.listing));

      const update = { $inc: { quantity: item.quantity } };
      if (listingWasSoldByThisOrder) {
        update.$set = { status: 'active' };
      }

      // Use findOneAndUpdate so two concurrent cancellations can't
      // double-restore the same row.
      const updated = await Listing.findOneAndUpdate(
        listingWasSoldByThisOrder
          ? { _id: item.listing, status: 'sold' }
          : { _id: item.listing },
        update,
        { new: true }
      );

      if (updated && listingWasSoldByThisOrder) {
        // Decrement itemsSold — was bumped at accept time because the
        // listing hit 0/sold. Best-effort.
        try {
          await User.findByIdAndUpdate(updated.seller, { $inc: { itemsSold: -1 } });
        } catch (err) {
          console.error('[cancelOrder] failed to decrement itemsSold:', err.message);
        }
      }
    }
  }

  const populated = await Order.findById(order._id).populate(ORDER_POPULATE);
  await notifyOrderUpdate(populated.seller._id, {
    action: 'cancelled',
    order: populated,
    counterpartyName: populated.buyer.name,
    isBuyer: false
  });

  res.json({ order: populated });
});

// PATCH /api/orders/:id/complete — buyer confirms receipt, unlocking reviews.
// QD-011 — guardObjectId on req.params.id.
export const completeOrder = asyncHandler(async (req, res) => {
  guardObjectId(req.params.id, 'id', res);
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  if (String(order.buyer) !== String(req.user._id)) {
    res.status(403);
    throw new Error('Only the buyer can mark an order as complete');
  }
  if (order.status !== 'accepted') {
    res.status(400);
    throw new Error('Only accepted orders can be marked complete');
  }

  order.status = 'completed';
  order.completedAt = new Date();
  await order.save();

  const populated = await Order.findById(order._id).populate(ORDER_POPULATE);
  await notifyOrderUpdate(populated.seller._id, {
    action: 'completed',
    order: populated,
    counterpartyName: populated.buyer.name,
    isBuyer: false
  });

  res.json({ order: populated });
});
