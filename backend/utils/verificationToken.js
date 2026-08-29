import crypto from 'crypto';

// The raw token goes out in the email link and is never persisted.
// Only its SHA-256 hash is stored, the same pattern you'd use for a
// password-reset token — a DB leak alone can't be used to forge approvals.
export function generateVerificationToken() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashVerificationToken(rawToken);
  return { rawToken, tokenHash };
}

export function hashVerificationToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}