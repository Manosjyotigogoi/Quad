import mongoose from 'mongoose';

// QD-026 — Standalone paginated Notification collection.
//
// The embedded `User.notifications` array grows unbounded and gets
// serialized on every `/auth/me` call. To keep that array small (capped
// to ~100), full history lives here. Writes go to BOTH the embedded array
// (for fast "recent unread" reads) AND this collection (for full history
// + pagination). Reads for "all notifications, page N" hit this
// collection instead of the user doc.

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['order', 'verification', 'listing', 'message', 'system'],
      default: 'system'
    },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    link: { type: String, default: null },
    read: { type: Boolean, default: false, index: true }
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

// Most-recent-first per user — the common query shape.
notificationSchema.index({ user: 1, createdAt: -1 });

// THIRD-PASS HARDENING — TTL index so notifications auto-expire after
// 1 year. Without this, the standalone Notification collection grows
// unbounded. The embedded User.notifications array is already capped
// to ~100 via $slice in the pushNotification helper.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
