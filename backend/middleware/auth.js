import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { COOKIE_NAME } from '../utils/generateToken.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Requires a valid session cookie. Attaches the full user doc to req.user.
//
// QD-004 — Rejects tokens whose `version` claim doesn't match the
// user's current `tokenVersion` field. When the user resets/changes
// their password, `tokenVersion` is bumped, which invalidates every
// outstanding cookie for that user (including stolen ones) without
// waiting for the 30-day JWT expiry.
export const protect = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    res.status(401);
    throw new Error('Not logged in');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    res.status(401);
    throw new Error('Session expired, please log in again');
  }

  // select('+tokenVersion') — the field is select:false in the schema,
  // so we need to explicitly request it.
  const user = await User.findById(decoded.id).select('+tokenVersion');
  if (!user) {
    res.status(401);
    throw new Error('Account no longer exists');
  }

  // QD-004 — version mismatch means the cookie was issued before the
  // user's most recent password reset/change. Treat it as expired.
  if (decoded.version !== user.tokenVersion) {
    res.status(401);
    throw new Error('Session expired, please log in again');
  }

  req.user = user;
  next();
});

// Gate actions (posting, messaging, etc.) to fully verified students.
export const requireVerifiedStudent = (req, res, next) => {
  if (!req.user.isVerifiedStudent()) {
    res.status(403);
    throw new Error('Verify your .edu email and student ID before doing this');
  }
  next();
};

export const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Admin access only');
  }
  next();
};
