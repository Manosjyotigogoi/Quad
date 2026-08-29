import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const verificationSchema = new mongoose.Schema(
  {
    idCardUrl: { type: String, select: false },
    idCardPublicId: { type: String, select: false },
    // Aadhar fields are select:false so they NEVER come back on a normal
    // find()/findById() — only the admin controller explicitly selects them.
    aadharCardUrl: { type: String, select: false },
    aadharPublicId: { type: String, select: false },
    registrationNo: { type: String, trim: true },
    status: {
      type: String,
      enum: ['not_submitted', 'pending', 'approved', 'rejected'],
      default: 'not_submitted'
    },
    rejectionReason: { type: String, default: null },
    submittedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedVia: { type: String, enum: ['dashboard', 'email_link'], default: null },

    verificationTokenHash: { type: String, select: false },
    verificationTokenExpires: { type: Date, select: false }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    passwordHash: { type: String, required: true, select: false },

    emailVerified: { type: Boolean, default: false },
    otpHash: { type: String, select: false },
    otpExpires: { type: Date, select: false },
    // OTP brute-force lockout: after MAX_OTP_ATTEMPTS wrong tries, the OTP
    // is invalidated and the student must request a new one.
    otpAttempts: { type: Number, default: 0, select: false },

    // Login brute-force lockout: after MAX_LOGIN_ATTEMPTS wrong tries,
    // the account is temporarily locked for LOGIN_LOCKOUT_MINUTES.
    loginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, default: null, select: false },

    // Password reset: only the SHA-256 hash of the raw token is stored,
    // same pattern as the verification token — a DB leak can't forge resets.
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },

    role: { type: String, enum: ['student', 'admin'], default: 'student' },

    // QD-004 — Session version. Embedded as a `version` claim in every JWT
    // and bumped on password reset / change so a stolen pre-reset cookie
    // stops authenticating the moment the legitimate user rotates their
    // password. See middleware/auth.js -> protect().
    tokenVersion: { type: Number, default: 0, select: false },

    avatarUrl: { type: String, default: null },
    major: { type: String, default: '' },
    dorm: { type: String, default: '' },
    bio: { type: String, default: '', maxlength: 500 },

    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    itemsSold: { type: Number, default: 0 },

    verification: { type: verificationSchema, default: () => ({}) },

    // Saved searches / watch alerts: a user can opt to be notified
    // when new listings matching a query are posted.
    savedSearches: [
      {
        query: { type: String, default: '' },
        category: { type: String, default: '' },
        createdAt: { type: Date, default: Date.now },
        _id: false
      }
    ],

    // Notifications (in-app) — new listings matching saved searches,
    // order status changes, verification results, etc.
    //
    // NOTE: Mongoose defaults sub-documents to `_id: true`, so we do NOT
    // declare it explicitly. Doing so used to silently work in older
    // versions but throws `TypeError: Invalid schema configuration: 'True'
    // is not a valid type` under Mongoose 8.24.x (QD-001 regression).
    // The compile-time guard in tests/models.test.js catches this class
    // of regression going forward.
    //
    // QD-026 — This array is CAPPED to the most-recent ~100 entries
    // (via $slice on every push) so /auth/me stays fast regardless of
    // how many notifications a user has accumulated. Full history
    // lives in the standalone Notification collection (see
    // models/Notification.js) which is paginated separately.
    notifications: [
      {
        type: {
          type: String,
          enum: ['order', 'verification', 'listing', 'message', 'system'],
          default: 'system'
        },
        title: { type: String, required: true },
        body: { type: String, default: '' },
        link: { type: String, default: null },
        read: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now }
      }
    ],

    savedListings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Listing' }]
  },
  { timestamps: true }
);

userSchema.index({ 'verification.status': 1 });
userSchema.index({ 'notifications.read': 1 });

userSchema.methods.matchPassword = async function matchPassword(candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.methods.isVerifiedStudent = function isVerifiedStudent() {
  return this.emailVerified && this.verification.status === 'approved';
};

// Returns true if the account is currently in a temporary login lockout.
userSchema.methods.isLocked = function isLocked() {
  return Boolean(this.lockUntil) && this.lockUntil > new Date();
};

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('passwordHash')) return next();
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  next();
});

// QD-025 — Sync denormalized verificationStatus onto every Listing
// owned by this user. Without this, the verifiedOnly listing filter
// had to fetch ALL approved user IDs and build a huge $in array —
// slow + unbounded. With the denormalized field, we can index
// { status, verificationStatus, ... } and the query is O(log n).
//
// We fire-and-forget the Listing updateMany so a slow DB doesn't
// block the user save. The denormalized field will catch up on the
// next listing re-save if this update happens to fail.
userSchema.post('save', async function syncVerificationStatus() {
  if (!this.isModified('verification.status')) return;
  try {
    // Lazy-import to avoid a circular import at module load.
    const Listing = (await import('./Listing.js')).default;
    await Listing.updateMany(
      { seller: this._id },
      { $set: { verificationStatus: this.verification.status } }
    );
  } catch (err) {
    // Best-effort sync — don't fail the User save if Listing update
    // errors. The next listing re-save will catch up.
    console.error('[User.post-save] failed to sync verificationStatus to listings:', err.message);
  }
});

const User = mongoose.model('User', userSchema);
export default User;
