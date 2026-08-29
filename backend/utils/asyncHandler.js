// Wraps an async route handler so thrown errors reach errorHandler.js
// instead of crashing the process or needing try/catch everywhere.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
