import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';

// QD-011 — Validates that a string is a valid MongoDB ObjectId.
// Returns 400 + clean message if not, instead of letting Mongoose
// throw a CastError that bubbles up as a 500.
//
// Usage:
//   validateObjectId('listingId')(req, res, next);
// Or as route-level middleware:
//   router.post('/:listingId/review', validateObjectId('listingId'), handler);
export function validateObjectId(paramName) {
  return (req, res, next) => {
    const id = req.params[paramName] || req.body[paramName];
    if (!id || !mongoose.isValidObjectId(id)) {
      res.status(400);
      return next(new Error(`Invalid ${paramName}: must be a valid ObjectId`));
    }
    next();
  };
}

// Same check, but for use inside a controller when reading an ID from
// the request body (not a URL param). Returns true if valid; throws
// a 400-shaped error otherwise (use with `assertObjectId` below).
export function isValidObjectId(id) {
  return mongoose.isValidObjectId(id);
}

export function assertObjectId(id, paramName = 'id') {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error(`Invalid ${paramName}: must be a valid ObjectId`);
    err.statusCode = 400;
    throw err;
  }
}

// Convenience wrapper that lets a controller use the assert pattern
// with the project's asyncHandler without repeating boilerplate.
export const guardObjectId = (id, paramName = 'id', res) => {
  if (!mongoose.isValidObjectId(id)) {
    if (res) res.status(400);
    throw new Error(`Invalid ${paramName}: must be a valid ObjectId`);
  }
};
