import { describe, it, expect } from 'vitest';
import { generateOtp, verifyOtp, MAX_OTP_ATTEMPTS } from '../utils/otp.js';
import { generateResetToken, hashResetToken } from '../utils/passwordResetToken.js';
import { generateVerificationToken, hashVerificationToken } from '../utils/verificationToken.js';

describe('OTP utility', () => {
  it('generates a 6-digit code + hash + expiry', () => {
    const { code, hash, expires } = generateOtp();
    expect(code).toMatch(/^\d{6}$/);
    expect(hash).toHaveLength(64); // sha256 hex
    expect(expires.getTime()).toBeGreaterThan(Date.now());
  });

  it('verifies a correct code', () => {
    const { code, hash, expires } = generateOtp();
    expect(verifyOtp(code, hash, expires)).toBe(true);
  });

  it('rejects a wrong code', () => {
    const { hash, expires } = generateOtp();
    expect(verifyOtp('000000', hash, expires)).toBe(false);
  });

  it('rejects after expiry', () => {
    const { code, hash } = generateOtp();
    const past = new Date(Date.now() - 1000);
    expect(verifyOtp(code, hash, past)).toBe(false);
  });

  it('exposes MAX_OTP_ATTEMPTS as a sane number', () => {
    expect(MAX_OTP_ATTEMPTS).toBeGreaterThanOrEqual(3);
    expect(MAX_OTP_ATTEMPTS).toBeLessThanOrEqual(10);
  });
});

describe('password reset token utility', () => {
  it('generates a 64-char hex token + matching hash', () => {
    const { rawToken, tokenHash } = generateResetToken();
    expect(rawToken).toHaveLength(64);
    expect(hashResetToken(rawToken)).toBe(tokenHash);
  });

  it('rejects a tampered token', () => {
    const { rawToken, tokenHash } = generateResetToken();
    const tampered = rawToken.slice(0, -1) + (rawToken.slice(-1) === 'a' ? 'b' : 'a');
    expect(hashResetToken(tampered)).not.toBe(tokenHash);
  });
});

describe('verification token utility', () => {
  it('generates a token + matching hash', () => {
    const { rawToken, tokenHash } = generateVerificationToken();
    expect(rawToken).toHaveLength(64);
    expect(hashVerificationToken(rawToken)).toBe(tokenHash);
  });
});
