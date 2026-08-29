// CSRF protection via the "double-submit" custom-header pattern.
//
// HOW IT WORKS
// ============
// A cross-site form POST (the classic CSRF attack vector) can only send
// "simple" content types: application/x-www-form-urlencoded,
// multipart/form-data, or text/plain. It CANNOT set custom request headers
// like X-Requested-With.
//
// So if every state-changing request is required to carry the
// X-Requested-With: XMLHttpRequest header (which our own fetch() wrapper
// sets in frontend/src/utils/api.js), a browser-initiated cross-site form
// POST will fail this check and be rejected.
//
// application/json requests are additionally protected by CORS preflight —
// the browser sends an OPTIONS preflight which our CORS policy gates on
// origin.
//
// CRITICAL FIX (QD-007 regression caught in second-pass audit) —
// The email-link review POST endpoint (/api/admin/verifications/review-by-token)
// is rendered as an HTML form. Browser-rendered forms cannot set custom
// request headers like X-Requested-With, so the original CSRF middleware
// blocked the form submission — the entire email-link flow was broken
// in production (the integration tests masked this by setting the
// header explicitly).
//
// We exempt this specific endpoint because it is NOT authenticated by
// the JWT cookie (the auth-relevant identity is a single-use, hashed,
// expiring 64-char token in the request body). CSRF protection is
// only meaningful when the browser auto-attaches credentials (cookies);
// without cookie auth, there is nothing for a CSRF attack to forge.
// An attacker would need to know the 64-char random token (which is
// only delivered via the admin's email) to construct a forged POST.

const CSRF_EXEMPT_PATHS = new Set([
  '/api/admin/verifications/review-by-token'
]);

export function csrfHeaderCheck(req, res, next) {
  // Safe methods — never need CSRF protection
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  // Exempt token-authenticated endpoints (no cookie auth = no CSRF attack vector).
  if (CSRF_EXEMPT_PATHS.has(req.path)) return next();

  const requestedWith = req.headers['x-requested-with'];

  if (requestedWith !== 'XMLHttpRequest') {
    return res.status(403).json({
      message: 'Security check failed — this request is not allowed.'
    });
  }

  next();
}
