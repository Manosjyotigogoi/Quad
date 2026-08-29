import User from '../models/User.js';
import Listing from '../models/Listing.js';
import Review from '../models/Review.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendEmail, verificationSubmittedEmail } from '../utils/sendEmail.js';
import { generateVerificationToken } from '../utils/verificationToken.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import { guardObjectId } from '../middleware/validateObjectId.js';

const VERIFICATION_TOKEN_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

// GET /api/users/search?q=
export const searchUsers = asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    res.json({ users: [] });
    return;
  }

  // Escape regex special characters so the user's query can't inject
  // regex operators ($, *, etc.) into the search. QD-003 — uses the
  // shared escapeRegex helper so the same fix applies to every code
  // path that builds a $regex from user input.
  const escaped = escapeRegex(q);

  const users = await User.find({ name: { $regex: escaped, $options: 'i' } })
    .select('name avatarUrl dorm rating verification.status')
    .limit(8);

  res.json({
    users: users.map((u) => ({
      id: u._id,
      name: u.name,
      avatarUrl: u.avatarUrl,
      dorm: u.dorm,
      rating: u.rating,
      verified: u.verification.status === 'approved'
    }))
  });
});

// GET /api/users/:id — public-facing seller profile
// QD-011 — guardObjectId on req.params.id.
export const getUserProfile = asyncHandler(async (req, res) => {
  guardObjectId(req.params.id, 'id', res);
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  const [listings, soldListings, reviews] = await Promise.all([
    Listing.find({ seller: user._id, status: 'active' }).sort({ createdAt: -1 }),
    Listing.find({ seller: user._id, status: 'sold' }).sort({ createdAt: -1 }),
    Review.find({ seller: user._id }).populate('reviewer', 'name').sort({ createdAt: -1 })
  ]);

  res.json({
    user: {
      id: user._id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      major: user.major,
      dorm: user.dorm,
      bio: user.bio,
      rating: user.rating,
      reviewCount: user.reviewCount,
      itemsSold: user.itemsSold,
      verified: user.verification.status === 'approved',
      createdAt: user.createdAt
    },
    listings,
    soldListings,
    reviews
  });
});

// PUT /api/users/me
export const updateMyProfile = asyncHandler(async (req, res) => {
  const editable = ['name', 'major', 'dorm', 'bio'];
  editable.forEach((field) => {
    if (req.body[field] !== undefined) req.user[field] = req.body[field];
  });
  await req.user.save();
  res.json({ message: 'Profile updated', user: publicUser(req.user) });
});

// PUT /api/users/me/avatar
export const updateMyAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('No image uploaded');
  }
  req.user.avatarUrl = req.file.path;
  await req.user.save();
  res.json({ message: 'Avatar updated', avatarUrl: req.user.avatarUrl, user: publicUser(req.user) });
});

// GET /api/users/me/listings | /sold | /saved
export const getMyListings = asyncHandler(async (req, res) => {
  const listings = await Listing.find({ seller: req.user._id, status: 'active' }).sort({
    createdAt: -1
  });
  res.json({ listings });
});

export const getMySoldListings = asyncHandler(async (req, res) => {
  const listings = await Listing.find({ seller: req.user._id, status: 'sold' }).sort({
    createdAt: -1
  });
  res.json({ listings });
});

export const getMySavedListings = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate({
    path: 'savedListings',
    match: { status: 'active' }
  });
  res.json({ listings: user.savedListings });
});

// POST /api/users/me/verification
export const submitVerification = asyncHandler(async (req, res) => {
  const { registrationNo } = req.body;
  const idCardFile = req.files?.idCard?.[0];
  const aadharFile = req.files?.aadharCard?.[0];

  if (!registrationNo || !idCardFile || !aadharFile) {
    res.status(400);
    throw new Error('Registration number, ID card photo, and Aadhar card photo are all required');
  }

  const { rawToken, tokenHash } = generateVerificationToken();

  req.user.verification = {
    idCardUrl: idCardFile.path,
    idCardPublicId: idCardFile.filename,
    aadharCardUrl: aadharFile.path,
    aadharPublicId: aadharFile.filename,
    registrationNo,
    status: 'pending',
    submittedAt: new Date(),
    rejectionReason: null,
    reviewedAt: null,
    reviewedBy: null,
    verificationTokenHash: tokenHash,
    verificationTokenExpires: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS)
  };
  await req.user.save();

  if (process.env.ADMIN_EMAIL) {
    try {
      const base = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
      const approveUrl = `${base}/api/admin/verify-via-email?token=${rawToken}&action=approve`;
      const rejectUrl = `${base}/api/admin/verify-via-email?token=${rawToken}&action=reject`;

      const { subject, text, html } = verificationSubmittedEmail(req.user, { approveUrl, rejectUrl });
      await sendEmail({ to: process.env.ADMIN_EMAIL, subject, text, html });
    } catch (err) {
      console.error('Failed to send admin verification-notification email:', err.message);
    }
  }

  res.json({
    message: 'Verification submitted — an admin will review it shortly.',
    status: 'pending'
  });
});

// GET /api/users/me/verification
export const getMyVerificationStatus = asyncHandler(async (req, res) => {
  res.json({
    status: req.user.verification.status,
    rejectionReason: req.user.verification.rejectionReason,
    registrationNo: req.user.verification.registrationNo
  });
});

// ---- Saved searches (watch alerts) --------------------------------------

// GET /api/users/me/saved-searches
export const getMySavedSearches = asyncHandler(async (req, res) => {
  res.json({ savedSearches: req.user.savedSearches || [] });
});

// POST /api/users/me/saved-searches  { query, category }
export const addSavedSearch = asyncHandler(async (req, res) => {
  const { query = '', category = '' } = req.body;
  if (!query && !category) {
    res.status(400);
    throw new Error('Provide a search query, a category, or both.');
  }
  // Prevent duplicates.
  const exists = (req.user.savedSearches || []).some(
    (s) => s.query === query.trim() && s.category === category
  );
  if (!exists) {
    req.user.savedSearches.push({ query: query.trim(), category });
    await req.user.save();
  }
  res.json({ savedSearches: req.user.savedSearches });
});

// DELETE /api/users/me/saved-searches/:index
// QD-011 — index is a numeric array index, not an ObjectId, but we
// still validate it's a non-negative integer before using it.
export const removeSavedSearch = asyncHandler(async (req, res) => {
  const idx = Number(req.params.index);
  if (Number.isNaN(idx) || idx < 0 || idx >= (req.user.savedSearches || []).length) {
    res.status(404);
    throw new Error('Saved search not found');
  }
  req.user.savedSearches.splice(idx, 1);
  await req.user.save();
  res.json({ savedSearches: req.user.savedSearches });
});

// ---- Notifications ------------------------------------------------------

// GET /api/users/me/notifications?page=&limit=
// QD-026 — Returns from the standalone Notification collection (full
// history, paginated) instead of the embedded array. The embedded
// array is still used for "recent unread badge" reads via /auth/me.
export const getMyNotifications = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;
  const Notification = (await import('../models/Notification.js')).default;
  const filter = { user: req.user._id };
  const [notifications, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter)
  ]);
  res.json({ notifications, total, page, pages: Math.ceil(total / limit) });
});

// PATCH /api/users/me/notifications/:id/read
export const markNotificationRead = asyncHandler(async (req, res) => {
  const notif = req.user.notifications.id(req.params.id);
  if (!notif) {
    res.status(404);
    throw new Error('Notification not found');
  }
  notif.read = true;
  await req.user.save();
  res.json({ notification: notif });
});

// DELETE /api/users/me/notifications/:id
export const deleteNotification = asyncHandler(async (req, res) => {
  const notif = req.user.notifications.id(req.params.id);
  if (!notif) {
    res.status(404);
    throw new Error('Notification not found');
  }
  notif.deleteOne();
  await req.user.save();
  res.json({ message: 'Notification removed' });
});

// Reusable mapper — used everywhere a public user shape is needed so
// we never accidentally leak select:false fields like passwordHash.
function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    avatarUrl: user.avatarUrl,
    major: user.major,
    dorm: user.dorm,
    bio: user.bio,
    rating: user.rating,
    reviewCount: user.reviewCount,
    itemsSold: user.itemsSold,
    emailVerified: user.emailVerified,
    verificationStatus: user.verification?.status || 'not_submitted'
  };
}
