import Listing from '../models/Listing.js';
import User from '../models/User.js';
import Cart from '../models/Cart.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import { guardObjectId } from '../middleware/validateObjectId.js';
import { pushNotification } from '../utils/notifications.js';
import { getOptimizedImageUrl } from '../config/cloudinary.js';
import { emitToUser } from '../realtime/socket.js';

// THIRD-PASS OPTIMIZATION — transform Cloudinary URLs in listing
// responses to bandwidth-optimized WebP/AVIF at the right width.
function optimizeListingImages(listing, width = 800) {
  if (!listing || !listing.images) return listing;
  // Don't mutate the mongoose doc — return a plain object so the
  // transformation is only applied to the API response, not the
  // stored record (which needs the original URL for admin/audit access).
  const optimized = listing.toObject ? listing.toObject() : { ...listing };
  optimized.images = optimized.images.map((img) => ({
    ...img,
    url: getOptimizedImageUrl(img.url, { width })
  }));
  // Also optimize the populated seller avatarUrl.
  if (optimized.seller?.avatarUrl) {
    optimized.seller.avatarUrl = getOptimizedImageUrl(optimized.seller.avatarUrl, { width: 200 });
  }
  return optimized;
}

// Shared with orderController — pulls a listing out of every cart it
// sits in once it's no longer purchasable (deleted, sold, or stock hit 0).
export async function purgeListingFromCarts(listingId) {
  await Cart.updateMany({ 'items.listing': listingId }, { $pull: { items: { listing: listingId } } });
}

// GET /api/listings?category=textbooks&q=chemistry&minPrice=10&maxPrice=100&condition=Good&verifiedOnly=true&page=1&limit=24
export const getListings = asyncHandler(async (req, res) => {
  const {
    category,
    q,
    minPrice,
    maxPrice,
    condition,
    verifiedOnly,
    sort = 'newest',
    page = 1,
    limit = 24
  } = req.query;

  const filter = { status: 'active' };
  if (category && category !== 'all') filter.category = category;
  if (q) filter.$text = { $search: q };

  // QD-008 — Validate minPrice/maxPrice as finite numbers BEFORE building
  // the Mongo filter. The prior code passed NaN through silently (no
  // filter applied) on a *string* like "abc", but threw a 500 CastError
  // on a partial-number string like "1.2.3" because the conversion
  // happened twice (once in the Number() check, once in the assignment)
  // and only one path failed. Now both are validated up front; any
  // failure returns a clean 400.
  if (minPrice !== undefined && minPrice !== '') {
    const n = Number(minPrice);
    if (!Number.isFinite(n) || n < 0) {
      res.status(400);
      throw new Error('minPrice must be a non-negative number');
    }
    filter.price = filter.price || {};
    filter.price.$gte = n;
  }
  if (maxPrice !== undefined && maxPrice !== '') {
    const n = Number(maxPrice);
    if (!Number.isFinite(n) || n < 0) {
      res.status(400);
      throw new Error('maxPrice must be a non-negative number');
    }
    filter.price = filter.price || {};
    filter.price.$lte = n;
  }
  if (condition && condition !== 'all') {
    // Allow comma-separated conditions (e.g. "New,Like new")
    const conditions = condition.split(',').map((c) => c.trim()).filter(Boolean);
    if (conditions.length === 1) filter.condition = conditions[0];
    else if (conditions.length > 1) filter.condition = { $in: conditions };
  }

  // QD-025 — Verified-only filter uses the denormalized
  // verificationStatus field on Listing (synced via User.post-save hook)
  // instead of fetching all approved user IDs + building a huge $in
  // array. The compound index { status, verificationStatus, category,
  // price } serves this query directly.
  if (verifiedOnly === 'true') {
    filter.verificationStatus = 'approved';
  }

  const skip = (Number(page) - 1) * Number(limit);

  let sortOption = { createdAt: -1 }; // newest
  if (sort === 'price-low') sortOption = { price: 1 };
  else if (sort === 'price-high') sortOption = { price: -1 };

  const [listings, total] = await Promise.all([
    Listing.find(filter)
      .populate('seller', 'name avatarUrl rating dorm verification.status')
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit)),
    Listing.countDocuments(filter)
  ]);

  res.json({
    listings: listings.map((l) => optimizeListingImages(l, 800)),
    total,
    page: Number(page),
    pages: Math.ceil(total / limit)
  });
});

// GET /api/listings/:id
// NOTE: now populates verification.status to match the list endpoint.
// QD-011 — guards req.params.id with guardObjectId so a malformed ID
// returns 400 instead of 500 CastError.
export const getListingById = asyncHandler(async (req, res) => {
  guardObjectId(req.params.id, 'id', res);
  const listing = await Listing.findById(req.params.id).populate(
    'seller',
    'name avatarUrl major dorm rating reviewCount itemsSold verification.status createdAt'
  );
  if (!listing) {
    res.status(404);
    throw new Error('Listing not found');
  }
  // Detail page uses a wider image (1200px vs 800px for cards).
  res.json({ listing: optimizeListingImages(listing, 1200) });
});

// POST /api/listings
// THIRD-PASS HARDENING — per-user listing cap so a single seller can't
// pollute the marketplace with thousands of listings. Default cap is 100.
const MAX_LISTINGS_PER_USER = Number(process.env.MAX_LISTINGS_PER_USER) || 100;

export const createListing = asyncHandler(async (req, res) => {
  const { title, description, price, wasPrice, condition, category, pickupSpot, quantity } = req.body;

  if (!title || price === undefined || !condition || !category || !pickupSpot) {
    res.status(400);
    throw new Error('Title, price, condition, category, and pickup spot are required');
  }

  const qty = quantity === undefined || quantity === '' ? 1 : Number(quantity);
  if (!Number.isFinite(qty) || qty < 1) {
    res.status(400);
    throw new Error('Quantity must be at least 1');
  }

  // QD-resource-limit — enforce per-user listing cap.
  const existingCount = await Listing.countDocuments({
    seller: req.user._id,
    status: { $in: ['active', 'sold'] }
  });
  if (existingCount >= MAX_LISTINGS_PER_USER) {
    res.status(429);
    throw new Error(
      `You've reached the per-seller listing cap of ${MAX_LISTINGS_PER_USER}. ` +
        'Remove some old listings before posting new ones.'
    );
  }

  const images = (req.files || []).map((f) => ({ url: f.path, publicId: f.filename }));

  // QD-025 — Set the denormalized verificationStatus from the seller's
  // current verification status so the verifiedOnly filter works for
  // newly-created listings too (the User.post-save hook only syncs
  // existing listings when the user's status flips).
  const seller = await User.findById(req.user._id).select('verification.status');
  const listing = await Listing.create({
    title,
    description,
    price,
    wasPrice: wasPrice || undefined,
    condition,
    category,
    pickupSpot,
    quantity: qty,
    images,
    seller: req.user._id,
    verificationStatus: seller?.verification?.status || 'not_submitted'
  });

  // Notify users who have a saved search matching this new listing.
  try {
    await notifySavedSearches(listing);
  } catch (err) {
    console.error('Saved-search notification failed:', err.message);
  }

  res.status(201).json({ listing });
});

// Checks each user's savedSearches for a match against the new listing
// and pushes an in-app notification + real-time event to those who match.
//
// QD-003 — The user-controlled listing.title is escaped via escapeRegex
// before being used as a $regex source. Without escaping, a title like
// `(a+)+$` triggers catastrophic backtracking inside Mongo's PCRE.
async function notifySavedSearches(listing) {
  // Build a query that finds users whose savedSearches array contains
  // an entry whose query matches the listing's title/description and/or
  // whose category matches.
  const orClauses = [];
  orClauses.push({
    'savedSearches.query': { $regex: escapeRegex(listing.title), $options: 'i' }
  });
  if (listing.category) {
    orClauses.push({ 'savedSearches.category': listing.category });
  }

  const users = await User.find({
    _id: { $ne: listing.seller },
    $or: orClauses
  }).select('savedSearches');

  for (const user of users) {
    let matched = false;
    for (const search of user.savedSearches || []) {
      const queryMatches = search.query && listing.title.toLowerCase().includes(search.query.toLowerCase());
      const categoryMatches = search.category && search.category === listing.category;
      if (search.query && search.category && (queryMatches || categoryMatches)) matched = true;
      else if (search.query && queryMatches) matched = true;
      else if (search.category && categoryMatches) matched = true;
    }
    if (!matched) continue;

    // CRITICAL FIX (QD-026 regression) — route through pushNotification
    // helper so the standalone Notification collection gets a row AND
    // the embedded array stays $slice-capped.
    await pushNotification(user._id, {
      type: 'listing',
      title: 'New listing matching your saved search',
      body: listing.title,
      link: `/listings/${listing._id}`
    });
  }
}

// PUT /api/listings/:id
// NOTE: 'status' is intentionally NOT in the editable list — sellers
// change status only via the dedicated mark-sold / delete endpoints so
// the itemsSold counter and cart purge stay consistent.
// QD-011 — guardObjectId on req.params.id.
export const updateListing = asyncHandler(async (req, res) => {
  guardObjectId(req.params.id, 'id', res);
  const listing = await Listing.findById(req.params.id);
  if (!listing) {
    res.status(404);
    throw new Error('Listing not found');
  }
  if (String(listing.seller) !== String(req.user._id)) {
    res.status(403);
    throw new Error('You can only edit your own listings');
  }
  if (listing.status !== 'active') {
    res.status(400);
    throw new Error("Sold or removed listings can't be edited");
  }

  const editable = [
    'title',
    'description',
    'price',
    'wasPrice',
    'condition',
    'category',
    'pickupSpot',
    'quantity'
  ];

  editable.forEach((field) => {
    if (req.body[field] !== undefined) listing[field] = req.body[field];
  });

  // If new images were uploaded, append them (max 6 total).
  const newImages = (req.files || []).map((f) => ({ url: f.path, publicId: f.filename }));
  if (newImages.length > 0) {
    listing.images = [...(listing.images || []), ...newImages].slice(0, 6);
  }

  await listing.save();
  res.json({ listing });
});

// DELETE /api/listings/:id
// QD-011 — guardObjectId on req.params.id.
export const deleteListing = asyncHandler(async (req, res) => {
  guardObjectId(req.params.id, 'id', res);
  const listing = await Listing.findById(req.params.id);
  if (!listing) {
    res.status(404);
    throw new Error('Listing not found');
  }
  if (String(listing.seller) !== String(req.user._id) && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('You can only delete your own listings');
  }

  await listing.deleteOne();
  await purgeListingFromCarts(listing._id);
  res.json({ message: 'Listing removed' });
});

// POST /api/listings/:id/save — toggle save/watch for the current user
// QD-011 — guardObjectId on req.params.id.
export const toggleSaveListing = asyncHandler(async (req, res) => {
  guardObjectId(req.params.id, 'id', res);
  const listing = await Listing.findById(req.params.id);
  if (!listing) {
    res.status(404);
    throw new Error('Listing not found');
  }

  const alreadySaved = listing.savedBy.some((id) => String(id) === String(req.user._id));

  if (alreadySaved) {
    listing.savedBy = listing.savedBy.filter((id) => String(id) !== String(req.user._id));
    await User.findByIdAndUpdate(req.user._id, { $pull: { savedListings: listing._id } });
  } else {
    listing.savedBy.push(req.user._id);
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { savedListings: listing._id } });
  }

  await listing.save();
  res.json({ saved: !alreadySaved, watchers: listing.savedBy.length });
});

// PATCH /api/listings/:id/mark-sold
// QD-011 — guardObjectId on req.params.id.
export const markListingSold = asyncHandler(async (req, res) => {
  guardObjectId(req.params.id, 'id', res);
  const listing = await Listing.findById(req.params.id);
  if (!listing) {
    res.status(404);
    throw new Error('Listing not found');
  }
  if (String(listing.seller) !== String(req.user._id)) {
    res.status(403);
    throw new Error('You can only mark your own listings as sold');
  }
  if (listing.status === 'sold') {
    res.status(400);
    throw new Error('This listing is already marked as sold');
  }

  listing.status = 'sold';
  await listing.save();
  await User.findByIdAndUpdate(req.user._id, { $inc: { itemsSold: 1 } });
  await purgeListingFromCarts(listing._id);

  res.json({ listing });
});
