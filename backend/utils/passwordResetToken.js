import crypto from 'crypto';

const RESET_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Same pattern as verificationToken.js: the raw token goes out in the
// email link and is never persisted. Only its SHA-256 hash is stored.
export function generateResetToken() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(rawToken);
  const expires = new Date(Date.now() + RESET_TTL_MS);
  return { rawToken, tokenHash, expires };
}

export function hashResetToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export { RESET_TTL_MS };
