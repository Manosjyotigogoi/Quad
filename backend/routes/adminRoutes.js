import { Router } from 'express';
import {
  listVerifications,
  reviewVerification,
  verifyViaEmail,
  reviewVerificationByToken,
  getAdminStats,
  listAuditLog
} from '../controllers/adminController.js';
import { protect, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Public routes — no JWT, no admin role.
//
// 1) GET  /api/admin/verify-via-email?token=...&action=approve|reject
//    Renders a fully-escaped HTML confirmation page. NO state mutation.
//    (QD-002 / QD-007 fix: used to mutate state on a GET + interpolate
//    unescaped user-controlled fields into raw HTML.)
//
// 2) POST /api/admin/verifications/review-by-token
//    Body: { token, action, reason? }
//    State-changing endpoint. Authenticates via the single-use, hashed,
//    expiring email token. The global CSRF middleware enforces the
//    X-Requested-With header, so cross-site forms can't reach this.
router.get('/verify-via-email', verifyViaEmail);
router.post('/verifications/review-by-token', reviewVerificationByToken);

// Everything below requires an authenticated admin session.
router.use(protect, requireAdmin);

router.get('/stats', getAdminStats);
router.get('/verifications', listVerifications);
router.patch('/verifications/:userId', reviewVerification);
router.get('/audit-log', listAuditLog);

export default router;
