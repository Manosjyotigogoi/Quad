import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generateOtp, verifyOtp as checkOtp, MAX_OTP_ATTEMPTS } from '../utils/otp.js';
import { sendEmail, otpEmail, passwordResetEmail } from '../utils/sendEmail.js';
import { issueAuthCookie, clearAuthCookie } from '../utils/generateToken.js';
import { generateResetToken, hashResetToken } from '../utils/passwordResetToken.js';
import { emitToUser } from '../realtime/socket.js';

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function isAllowedCollegeEmail(email) {
  const domain = (process.env.COLLEGE_EMAIL_DOMAIN || '').toLowerCase().trim();
  const lower = email.toLowerCase();
  if (domain) return lower.endsWith(`@${domain}`);
  return lower.endsWith('.edu');
}

// POST /api/auth/register
// Step 1: name, email, phone, password. Creates an unverified account
// and emails a one-time code. Does NOT log the user in yet.
//
// QD-012 — Always returns 201 even when an account already exists, to
// avoid leaking account existence. If a duplicate is detected, we
// still send the OTP code to the existing user (so a legitimate user
// who forgot they registered gets a useful "did you mean to log in?"
// nudge via the OTP email) but the HTTP response is identical to a
// fresh registration.
export const register = asyncHandler(async (req, res) => {
  const { name, email, phone, password } = req.body;

  if (!name || !email || !phone || !password) {
    res.status(400);
    throw new Error('Name, email, phone, and password are all required');
  }
  if (!isAllowedCollegeEmail(email)) {
    res.status(400);
    throw new Error('Use your college email address to sign up');
  }
  if (password.length < 8) {
    res.status(400);
    throw new Error('Password must be at least 8 characters');
  }

  // QD-012 — Don't reveal whether an account exists. Check then either
  // (a) create + email OTP, or (b) email OTP to the existing user as a
  // gentle "you already have an account — log in instead" nudge. Either
  // way, the HTTP response is identical.
  let user = await User.findOne({ $or: [{ email: email.toLowerCase() }, { phone }] }).select('+otpHash +otpExpires +otpAttempts');
  if (!user) {
    const { code, hash, expires } = generateOtp();
    user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      passwordHash: password, // hashed by the pre-save hook on User model
      otpHash: hash,
      otpExpires: expires
    });
    const { subject, text } = otpEmail(code);
    await sendEmail({ to: user.email, subject, text });
  } else {
    // Existing user — re-issue an OTP as a "you already have an account"
    // nudge. We do NOT reveal in the HTTP response that the account
    // existed.
    const { code, hash, expires } = generateOtp();
    user.otpHash = hash;
    user.otpExpires = expires;
    user.otpAttempts = 0;
    await user.save();
    const { subject, text } = otpEmail(code);
    await sendEmail({ to: user.email, subject, text });
  }

  res.status(201).json({
    message: 'Account created. Check your email for a verification code.',
    userId: user._id,
    email: user.email
  });
});

// POST /api/auth/verify-otp
// Step 2: confirms the emailed code, marks the account verified, and
// logs the student in (sets the session cookie).
//
// QD-012 — Identical "invalid code" message regardless of: (a) whether
// the account exists, (b) whether the account is already verified, (c)
// whether the OTP was wrong / expired / locked out. And we don't reveal
// remaining attempts (QD-034).
export const verifyOtpAndLogin = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    res.status(400);
    throw new Error('Email and code are required');
  }

  const GENERIC_INVALID = 'That code is invalid or expired.';
  const GENERIC_LOCKED = 'Too many wrong codes. Please request a new one.';

  const user = await User.findOne({ email: email.toLowerCase() }).select('+otpHash +otpExpires +otpAttempts');
  if (!user) {
    res.status(400);
    throw new Error(GENERIC_INVALID);
  }

  // QD-012 — already-verified returns the SAME generic invalid-code
  // message so an attacker can't distinguish "wrong code" from
  // "already verified". The OTP email we sent in /register serves as
  // the nudge to log in instead.
  if (user.emailVerified) {
    res.status(400);
    throw new Error(GENERIC_INVALID);
  }

  // Brute-force lockout: too many wrong attempts invalidates the OTP.
  if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
    user.otpHash = undefined;
    user.otpExpires = undefined;
    user.otpAttempts = 0;
    await user.save();
    res.status(400);
    throw new Error(GENERIC_LOCKED);
  }

  if (!checkOtp(otp, user.otpHash, user.otpExpires)) {
    user.otpAttempts = (user.otpAttempts || 0) + 1;
    await user.save();
    res.status(400);
    // QD-034 — Don't reveal remaining attempts.
    throw new Error(user.otpAttempts >= MAX_OTP_ATTEMPTS ? GENERIC_LOCKED : GENERIC_INVALID);
  }

  user.emailVerified = true;
  user.otpHash = undefined;
  user.otpExpires = undefined;
  user.otpAttempts = 0;
  await user.save();

  issueAuthCookie(res, user);
  res.json({ message: 'Email verified', user: publicUser(user) });
});

// POST /api/auth/resend-otp
export const resendOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: email?.toLowerCase() }).select('+otpHash +otpExpires');
  if (!user || user.emailVerified) {
    // Don't reveal whether the account exists.
    return res.json({ message: 'If that account needs verification, a new code was sent.' });
  }

  const { code, hash, expires } = generateOtp();
  user.otpHash = hash;
  user.otpExpires = expires;
  user.otpAttempts = 0;
  await user.save();

  const { subject, text } = otpEmail(code);
  await sendEmail({ to: user.email, subject, text });

  res.json({ message: 'If that account needs verification, a new code was sent.' });
});

// POST /api/auth/login
// Regular day-to-day login with email + password. Requires the email
// to already be OTP-verified. Includes brute-force lockout.
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400);
    throw new Error('Email and password are required');
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash +loginAttempts +lockUntil');

  // Always return the same error to prevent account enumeration.
  const invalidCreds = 'Invalid email or password';
  if (!user) {
    res.status(401);
    throw new Error(invalidCreds);
  }

  // Check lockout.
  if (user.isLocked()) {
    const remainingMs = new Date(user.lockUntil).getTime() - Date.now();
    const minutes = Math.ceil(remainingMs / 60000);
    res.status(429);
    throw new Error(`Account temporarily locked. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
  }

  if (!(await user.matchPassword(password))) {
    // Increment failed-attempt counter.
    user.loginAttempts = (user.loginAttempts || 0) + 1;
    if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + LOGIN_LOCKOUT_MS);
    }
    await user.save();

    if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      res.status(429);
      throw new Error('Too many failed attempts. Account locked for 15 minutes.');
    }
    res.status(401);
    throw new Error(invalidCreds);
  }

  if (!user.emailVerified) {
    // Don't reveal "email not verified" to prevent enumeration — use
    // the same generic message. The student should already know their
    // email isn't verified if they just registered.
    res.status(401);
    throw new Error(invalidCreds);
  }

  // Successful login — reset counters.
  user.loginAttempts = 0;
  user.lockUntil = undefined;
  await user.save();

  issueAuthCookie(res, user);
  res.json({ message: 'Logged in', user: publicUser(user) });
});

// POST /api/auth/logout
export const logout = asyncHandler(async (req, res) => {
  clearAuthCookie(res);
  res.json({ message: 'Logged out' });
});

// GET /api/auth/me
export const getMe = asyncHandler(async (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// POST /api/auth/forgot-password
// Generates a one-time reset token and emails a reset link. Always
// returns the same response so the endpoint can't be used to enumerate.
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: email?.toLowerCase() }).select('+resetTokenHash +resetTokenExpires');

  if (user && user.emailVerified) {
    const { rawToken, tokenHash, expires } = generateResetToken();
    user.resetTokenHash = tokenHash;
    user.resetTokenExpires = expires;
    await user.save();

    const base = process.env.SERVER_URL || process.env.CLIENT_URL || `http://localhost:${process.env.PORT || 5000}`;
    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${rawToken}`;
    const { subject, text, html } = passwordResetEmail(user, resetUrl);
    await sendEmail({ to: user.email, subject, text, html }).catch(() => {});
  }

  res.json({ message: 'If an account exists for that email, a reset link has been sent.' });
});

// POST /api/auth/reset-password
// Body: { token, password }. Validates the token hash + expiry, sets
// the new password, clears the token (single-use).
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    res.status(400);
    throw new Error('Token and new password are required');
  }
  if (password.length < 8) {
    res.status(400);
    throw new Error('Password must be at least 8 characters');
  }

  const tokenHash = hashResetToken(token);
  // CRITICAL FIX (QD-004 regression caught in second-pass audit) —
  // MUST include +tokenVersion in the .select() because the schema
  // declares it select:false. Without it, user.tokenVersion is
  // undefined and the bump line evaluates as (undefined || 0) + 1 = 1
  // every time — meaning the SECOND reset doesn't actually bump, so
  // cookies from after the FIRST reset stay valid forever.
  const user = await User.findOne({
    resetTokenHash: tokenHash,
    resetTokenExpires: { $gt: new Date() }
  }).select('+resetTokenHash +resetTokenExpires +passwordHash +tokenVersion');

  if (!user) {
    res.status(400);
    throw new Error('This reset link is invalid or expired. Please request a new one.');
  }

  user.passwordHash = password; // pre-save hook hashes it
  user.resetTokenHash = undefined;
  user.resetTokenExpires = undefined;
  // QD-004 — bump tokenVersion so any stolen pre-reset cookie (this one
  // included) is rejected by the protect middleware going forward.
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  // Notify the user in real time (if online) + their other sessions.
  emitToUser(user._id, 'auth:password-reset', { message: 'Your password was just changed.' });

  res.json({ message: 'Password updated. You can now log in with your new password.' });
});

// POST /api/auth/change-password
// For logged-in users who want to change their password from the profile.
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400);
    throw new Error('Current password and new password are required');
  }
  if (newPassword.length < 8) {
    res.status(400);
    throw new Error('New password must be at least 8 characters');
  }

  const user = await User.findById(req.user._id).select('+passwordHash +tokenVersion');
  if (!(await user.matchPassword(currentPassword))) {
    res.status(401);
    throw new Error('Your current password is incorrect');
  }

  user.passwordHash = newPassword;
  // QD-004 — bump tokenVersion so any other outstanding cookie (e.g. on
  // a stolen device, or an ex-roommate's logged-in browser) is rejected
  // by the protect middleware going forward. The current device's
  // cookie is also invalidated — the user must re-login. That's an
  // intentional UX cost for the security benefit, and matches what
  // most apps do after a password change.
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  // Re-issue a fresh cookie for the current device so the user doesn't
  // have to manually log back in immediately after changing their
  // password from this same session.
  issueAuthCookie(res, user);

  res.json({ message: 'Password updated' });
});

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
