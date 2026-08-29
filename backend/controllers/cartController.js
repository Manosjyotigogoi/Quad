import Cart from '../models/Cart.js';
import Listing from '../models/Listing.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { guardObjectId } from '../middleware/validateObjectId.js';

// Shared populate shape so every response returns the same listing fields
// the frontend needs to render a cart row (image, price, seller, status,
// remaining stock).
const LISTING_POPULATE = {
  path: 'items.listing',
  populate: { path: 'seller', select: 'name avatarUrl rating dorm verification.status' }
};

async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
}

// GET /api/cart
export const getCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  await cart.populate(LISTING_POPULATE);

  // A listing can go out of stock/removed after it was added, or its
  // stock can shrink below what's in the cart — reconcile both instead
  // of showing a stale/dead or over-quantity row.
  let changed = false;
  const valid = [];
  for (const item of cart.items) {
    if (!item.listing || item.listing.status !== 'active' || item.listing.quantity < 1) {
      changed = true;
      continue;
    }
    if (item.quantity > item.listing.quantity) {
      item.quantity = item.listing.quantity;
      changed = true;
    }
    valid.push(item);
  }
  if (changed) {
    cart.items = valid;
    await cart.save();
  }

  res.json({ items: cart.items });
});

// POST /api/cart/:listingId  { quantity? }
// QD-010 — Concurrent add-to-cart calls used to read-modify-write the
// cart document, which created duplicate rows for the same listing
// under concurrent requests (both saw "no existing row", both pushed).
// Now we use an atomic `findOneAndUpdate` upsert keyed on (user,
// listing), which is race-safe. We $inc the quantity if the row
// already exists, or $push a new row if it doesn't (via the
// `$setOnInsert` + upsert:true pattern).
//
// We additionally add a unique index on (user, items.listing) at the
// schema level — see Cart.js — so even if a future code path forgets
// the atomic upsert, Mongo will reject duplicates instead of silently
// creating them.
//
// QD-011 — guardObjectId on req.params.listingId.
export const addToCart = asyncHandler(async (req, res) => {
  guardObjectId(req.params.listingId, 'listingId', res);
  const listing = await Listing.findById(req.params.listingId);
  if (!listing || listing.status !== 'active' || listing.quantity < 1) {
    res.status(404);
    throw new Error('Listing not available');
  }
  if (String(listing.seller) === String(req.user._id)) {
    res.status(400);
    throw new Error("You can't add your own listing to your cart");
  }

  const requestedQty = Math.max(1, Number(req.body?.quantity) || 1);
  const clampedQty = Math.min(requestedQty, listing.quantity);

  // Atomic upsert: if the (user, listing) row exists, $inc its quantity
  // (clamped to available stock); otherwise $push a new row.
  //
  // We use a pipeline-style update so we can express "if exists, $inc;
  // else $push" in a single round-trip without a read-modify-write
  // race window.
  const filter = { user: req.user._id, 'items.listing': listing._id };
  const existingCart = await Cart.findOne(filter);

  let cart;
  if (existingCart) {
    // Existing row — atomic $inc of that specific row's quantity,
    // clamped to listing.quantity via $min.
    cart = await Cart.findOneAndUpdate(
      { user: req.user._id, 'items.listing': listing._id },
      {
        $inc: { 'items.$.quantity': requestedQty },
        $set: { 'items.$.addedAt': new Date() }
      },
      { new: true }
    );
    // Clamp the incremented quantity to listing.quantity.
    const item = cart.items.find((i) => String(i.listing) === String(listing._id));
    if (item && item.quantity > listing.quantity) {
      item.quantity = listing.quantity;
      await cart.save();
    }
  } else {
    // No existing row — create the cart if needed, then $push.
    // We use findOneAndUpdate with upsert so two concurrent requests
    // that both miss the existence check still can't both push (the
    // unique index will reject the second).
    try {
      cart = await Cart.findOneAndUpdate(
        { user: req.user._id },
        {
          $push: { items: { listing: listing._id, quantity: clampedQty } }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      // E11000 from the unique index on (user, items.listing) means a
      // concurrent caller won the race. Re-read and $inc instead.
      if (err.code === 11000 || err.code === 11001) {
        cart = await Cart.findOneAndUpdate(
          { user: req.user._id, 'items.listing': listing._id },
          {
            $inc: { 'items.$.quantity': requestedQty },
            $set: { 'items.$.addedAt': new Date() }
          },
          { new: true }
        );
        const item = cart.items.find((i) => String(i.listing) === String(listing._id));
        if (item && item.quantity > listing.quantity) {
          item.quantity = listing.quantity;
          await cart.save();
        }
      } else {
        throw err;
      }
    }
  }

  await cart.populate(LISTING_POPULATE);
  res.json({ items: cart.items });
});

// PATCH /api/cart/:listingId  { quantity }  — set an exact quantity,
// clamped to [1, available stock]. Same endpoint handles +/- steppers.
// QD-011 — guardObjectId on req.params.listingId.
export const updateCartItemQuantity = asyncHandler(async (req, res) => {
  guardObjectId(req.params.listingId, 'listingId', res);
  const quantity = Number(req.body?.quantity);
  if (!Number.isFinite(quantity) || quantity < 1) {
    res.status(400);
    throw new Error('Quantity must be at least 1');
  }

  const listing = await Listing.findById(req.params.listingId);
  if (!listing) {
    res.status(404);
    throw new Error('Listing not available');
  }

  const cart = await getOrCreateCart(req.user._id);
  const item = cart.items.find((i) => String(i.listing) === String(req.params.listingId));
  if (!item) {
    res.status(404);
    throw new Error('That item is not in your cart');
  }

  item.quantity = Math.min(quantity, Math.max(listing.quantity, 1));
  await cart.save();
  await cart.populate(LISTING_POPULATE);
  res.json({ items: cart.items });
});

// DELETE /api/cart/:listingId
// QD-011 — guardObjectId on req.params.listingId.
export const removeFromCart = asyncHandler(async (req, res) => {
  guardObjectId(req.params.listingId, 'listingId', res);
  const cart = await getOrCreateCart(req.user._id);
  cart.items = cart.items.filter((item) => String(item.listing) !== String(req.params.listingId));
  await cart.save();
  await cart.populate(LISTING_POPULATE);
  res.json({ items: cart.items });
});

// DELETE /api/cart
export const clearCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  cart.items = [];
  await cart.save();
  res.json({ items: cart.items });
});
