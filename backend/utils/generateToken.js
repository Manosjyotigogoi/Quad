import jwt from 'jsonwebtoken';

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'quad_token';

// QD-004 — Embeds `user.tokenVersion` as a `version` claim in every JWT.
// The protect middleware rejects tokens whose `version` claim doesn't
// match the user's current `tokenVersion`, so a stolen cookie stops
// authenticating the moment the legitimate user rotates their password.
export function issueAuthCookie(res, user) {
  const token = jwt.sign(
    {
      id: user._id,
      role: user.role,
      version: user.tokenVersion ?? 0
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: Number(process.env.COOKIE_MAX_AGE_MS) || 30 * 24 * 60 * 60 * 1000
  });

  return token;
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });
}

export { COOKIE_NAME };
