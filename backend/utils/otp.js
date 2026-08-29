import crypto from 'crypto';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const MAX_OTP_ATTEMPTS = 5;

export function generateOtp() {
  const code = crypto.randomInt(100000, 999999).toString();
  const hash = crypto.createHash('sha256').update(code).digest('hex');
  const expires = new Date(Date.now() + OTP_TTL_MS);
  return { code, hash, expires };
}

export function verifyOtp(candidateCode, storedHash, storedExpires) {
  if (!storedHash || !storedExpires) return false;
  if (new Date(storedExpires).getTime() < Date.now()) return false;
  // Use timingSafeEqual for a constant-time comparison to avoid
  // timing-based enumeration of the hash.
  const candidateHash = crypto.createHash('sha256').update(String(candidateCode)).digest('hex');
  const a = Buffer.from(candidateHash, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
