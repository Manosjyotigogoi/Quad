import Review from '../models/Review.js';
import Listing from '../models/Listing.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { guardObjectId } from '../middleware/validateObjectId.js';

// POST /api/reviews
// Gated on a COMPLETED order — a buyer can only review a seller after
// they've actually bought AND received an item from them. This prevents
// drive-by 1-star reviews from people who never transacted.
//
// QD-011 — Invalid listingId previously threw a 500 CastError. Now we
// validate up-front with guardObjectId and return a clean 400.
export const createReview = asyncHandler(async (req, res) => {
  const { listingId, rating, body } = req.body;

  // QD-011 — Validate listingId is a valid ObjectId BEFORE querying.
  guardObjectId(listingId, 'listingId', res);

  if (!Number.isFinite(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) {
    res.status(400);
    throw new Error('Rating must be between 1 and 5');
  }
  if (!body || !body.trim()) {
    res.status(400);
    throw new Error('Please write a few words about your experience.');
  }

  const listing = await Listing.findById(listingId);
  if (!listing) {
    res.status(404);
    throw new Error('Listing not found');
  }
  if (String(listing.seller) === String(req.user._id)) {
    res.status(400);
    throw new Error("You can't review your own listing");
  }

  // Verify the reviewer has a COMPLETED order for this listing from this seller.
  const completedOrder = await Order.findOne({
    buyer: req.user._id,
    seller: listing.seller,
    status: 'completed',
    'items.listing': listing._id
  });
  if (!completedOrder) {
    res.status(403);
    throw new Error('You can only review a seller after completing an order with them.');
  }

  let review;
  try {
    review = await Review.create({
      listing: listing._id,
      reviewer: req.user._id,
      seller: listing.seller,
      rating: Number(rating),
      body: body.trim()
    });
  } catch (err) {
    // Unique index on (listing, reviewer) — one review per buyer per listing.
    if (err.code === 11000) {
      res.status(409);
      throw new Error("You've already reviewed this item.");
    }
    throw err;
  }

  // Recompute the seller's aggregate rating.
  const agg = await Review.aggregate([
    { $match: { seller: listing.seller } },
    { $group: { _id: '$seller', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);
  if (agg[0]) {
    await User.findByIdAndUpdate(listing.seller, {
      rating: Math.round(agg[0].avgRating * 10) / 10,
      reviewCount: agg[0].count
    });
  }

  res.status(201).json({ review });
});

// GET /api/reviews/seller/:sellerId
// QD-011 — guardObjectId on req.params.sellerId.
export const getSellerReviews = asyncHandler(async (req, res) => {
  guardObjectId(req.params.sellerId, 'sellerId', res);
  const reviews = await Review.find({ seller: req.params.sellerId })
    .populate('reviewer', 'name avatarUrl')
    .populate('listing', 'title')
    .sort({ createdAt: -1 });
  res.json({ reviews });
});
