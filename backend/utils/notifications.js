import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { emitToUser } from '../realtime/socket.js';

// QD-026 — Centralized notification push helper.
//
// Every notification write goes through this helper so the embedded
// User.notifications array stays capped to ~100 entries (via $slice)
// AND a copy lands in the standalone Notification collection for full
// history + pagination.
//
// Why both?
//  - The embedded array keeps "recent unread" reads fast (no JOIN).
//  - The standalone collection keeps full history without bloating the
//    user document on every /auth/me call.
//
// Both writes are best-effort — a failure in either shouldn't block
// the calling operation (e.g. an accepted order should still succeed
// even if the notification email/push failed).

const MAX_EMBEDDED_NOTIFICATIONS = 100;

export async function pushNotification(userId, payload) {
  // 1. Standalone collection — full history.
  try {
    await Notification.create({ user: userId, ...payload });
  } catch (err) {
    console.error('[pushNotification] failed to write Notification row:', err.message);
  }

  // 2. Embedded array — capped to most-recent MAX_EMBEDDED_NOTIFICATIONS.
  // The $slice with a negative number keeps the LAST N elements after
  // the push, so old entries roll off the end.
  try {
    await User.updateOne(
      { _id: userId },
      {
        $push: {
          notifications: {
            $each: [payload],
            $slice: -MAX_EMBEDDED_NOTIFICATIONS
          }
        }
      }
    );
  } catch (err) {
    console.error('[pushNotification] failed to push embedded notification:', err.message);
  }

  // 3. Real-time push (always emits via the socket module —
  // emitToUser is a no-op if the user is offline, so it's safe to call).
  try {
    emitToUser(userId, 'notification:new', payload);
  } catch (err) {
    console.error('[pushNotification] failed to emit socket event:', err.message);
  }
}
