import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { guardObjectId } from '../middleware/validateObjectId.js';
import { getSignedVerificationUrl } from '../config/cloudinary.js';
import { hashVerificationToken } from '../utils/verificationToken.js';
import { sendEmail, verificationResultEmail, escapeHtml } from '../utils/sendEmail.js';
import { pushNotification } from '../utils/notifications.js';
import { logger } from '../utils/logger.js';
import { verificationsApprovedTotal, verificationsRejectedTotal } from '../utils/metrics.js';
import { emitToUser } from '../realtime/socket.js';

// Shared helper — writes one row to the append-only AuditLog collection
// (QD-015). Safe to call from both the dashboard and the email-link path.
//
// HARDENING (caught in second-pass audit) — the original swallowed
// failures with console.error only. We now use the structured logger
// so audit failures surface in production observability. The audit row
// is best-effort (still doesn't block the review action), but a missing
// row is now a visible error instead of a silent one.
async function recordAudit({ actorUserId, action, targetUserId, before, after, via, reason, req }) {
  try {
    await AuditLog.create({
      actorUserId: actorUserId || null,
      action,
      targetUserId,
      before,
      after,
      via,
      reason: reason || null,
      ip: req?.ip || null,
      userAgent: req?.get?.('user-agent') || null
    });
  } catch (err) {
    // Audit-log failures must never block the actual review action.
    // But they MUST be visible to ops — missing audit rows are a
    // compliance problem, not a silent degradation.
    logger.error(
      {
        err: { message: err.message, code: err.code, name: err.name },
        audit: { action, targetUserId: String(targetUserId), via, actorUserId: String(actorUserId || null) },
        req: { id: req?.id }
      },
      '[audit] failed to write AuditLog row — compliance gap'
    );
  }
}

// GET /api/admin/verifications?status=pending
export const listVerifications = asyncHandler(async (req, res) => {
  const status = req.query.status || 'pending';

  const users = await User.find({ 'verification.status': status })
    .select(
      'name email phone createdAt ' +
      'verification.status verification.registrationNo verification.submittedAt ' +
      'verification.reviewedAt verification.reviewedVia ' +
      '+verification.idCardPublicId +verification.aadharPublicId'
    )
    .sort({ 'verification.submittedAt': 1 });

  const results = users.map((u) => ({
    userId: u._id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    registrationNo: u.verification.registrationNo,
    submittedAt: u.verification.submittedAt,
    status: u.verification.status,
    reviewedAt: u.verification.reviewedAt,
    reviewedVia: u.verification.reviewedVia,
    idCardViewUrl: u.verification.idCardPublicId
      ? getSignedVerificationUrl(u.verification.idCardPublicId)
      : null,
    aadharCardViewUrl: u.verification.aadharPublicId
      ? getSignedVerificationUrl(u.verification.aadharPublicId)
      : null
  }));

  res.json({ verifications: results });
});

// Shared mutation — applies an approve/reject decision to a user's
// verification record, sends the result email + in-app notification,
// and writes the audit-log row. Used by both the dashboard path and the
// email-link path so the side effects stay identical.
async function applyVerificationDecision({ user, action, reason, via, actorUserId, req }) {
  const before = {
    status: user.verification.status,
    reviewedAt: user.verification.reviewedAt,
    reviewedBy: user.verification.reviewedBy,
    reviewedVia: user.verification.reviewedVia
  };

  user.verification.status = action === 'approve' ? 'approved' : 'rejected';
  user.verification.rejectionReason = action === 'reject' ? reason || 'Not specified' : null;
  user.verification.reviewedAt = new Date();
  user.verification.reviewedBy = actorUserId || null;
  user.verification.reviewedVia = via;

  // If this came from an email-link review, burn the single-use token.
  if (via === 'email_link') {
    user.verification.verificationTokenHash = undefined;
    user.verification.verificationTokenExpires = undefined;
  }

  await user.save();

  const after = {
    status: user.verification.status,
    reviewedAt: user.verification.reviewedAt,
    reviewedBy: user.verification.reviewedBy,
    reviewedVia: user.verification.reviewedVia,
    rejectionReason: user.verification.rejectionReason
  };

  await recordAudit({
    actorUserId,
    action,
    targetUserId: user._id,
    before,
    after,
    via,
    reason: user.verification.rejectionReason,
    req
  });

  // Prometheus counters for SLO dashboards.
  if (action === 'approve') {
    verificationsApprovedTotal.inc({ via });
  } else {
    verificationsRejectedTotal.inc({ via });
  }

  // Email the student the result.
  try {
    const { subject, text, html } = verificationResultEmail(user, {
      status: user.verification.status,
      reason: user.verification.rejectionReason
    });
    await sendEmail({ to: user.email, subject, text, html });
  } catch (err) {
    console.error('Failed to send verification-result email:', err.message);
  }

  // In-app notification for real-time delivery.
  // CRITICAL FIX (QD-026 regression caught in second-pass audit) —
  // Route through pushNotification helper so the standalone Notification
  // collection is written AND the embedded array is $slice-capped to ~100.
  // The previous code bypassed the helper, so the cap was never applied
  // and the standalone collection was never written.
  try {
    const notifPayload = {
      type: 'verification',
      title: action === 'approve' ? 'Your ID was approved' : 'Your ID was rejected',
      body: action === 'approve'
        ? 'You can now post listings, message sellers, and use the cart.'
        : (reason || 'Please resubmit with clearer photos.'),
      link: action === 'approve' ? '/profile' : '/verify'
    };
    await pushNotification(user._id, notifPayload);
  } catch (err) {
    console.error('Failed to push notification:', err.message);
  }
}

// PATCH /api/admin/verifications/:userId
// body: { action: 'approve' | 'reject', reason? }
// Auth: protect + requireAdmin (router-level).
// CSRF: X-Requested-With header (global middleware).
// QD-011 — guardObjectId on req.params.userId.
export const reviewVerification = asyncHandler(async (req, res) => {
  const { action, reason } = req.body;
  if (!['approve', 'reject'].includes(action)) {
    res.status(400);
    throw new Error('action must be "approve" or "reject"');
  }

  guardObjectId(req.params.userId, 'userId', res);
  const user = await User.findById(req.params.userId);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  if (user.verification.status !== 'pending') {
    res.status(400);
    throw new Error('This submission is not currently pending review');
  }

  await applyVerificationDecision({
    user,
    action,
    reason,
    via: 'dashboard',
    actorUserId: req.user._id,
    req
  });

  res.json({
    message: `Verification ${user.verification.status}`,
    status: user.verification.status
  });
});

// ============================================================================
// QD-002 / QD-007 — Email-link review flow, rewritten.
//
// OLD (vulnerable): GET /api/admin/verify-via-email?token=...&action=approve
//   interpolated `${user.name}` / `${user.email}` /
//   `${user.verification.registrationNo}` into raw HTML with no escaping
//   (stored XSS), and mutated state on a GET request (CSRF bypass).
//
// NEW (safe, two-step):
//   1) GET /api/admin/verify-via-email?token=...&action=approve|reject
//      → renders a login-gated confirmation HTML page that *escapes* every
//        interpolated value and contains a button that POSTs the actual
//        review to (2). NO state mutation happens here.
//   2) POST /api/admin/verifications/review-by-token
//      body: { token, action, reason? }
//      → state-changing endpoint. Requires the X-Requested-With CSRF header
//        (enforced globally by middleware/csrf.js). Authenticates via the
//        single-use, hashed, expiring email token — NOT a JWT — because the
//        whole point of the email link is one-click convenience.
// ============================================================================

// Builds a minimal, fully-escaped HTML confirmation page. Every value
// interpolated into the markup passes through escapeHtml() so a student
// who registered with `<script>` as their name cannot pop XSS in an
// admin's browser when the admin opens the email link.
function buildConfirmationPage({ title, action, user, token, postUrl }) {
  const safeTitle = escapeHtml(title);
  const safeAction = escapeHtml(action);
  const safeToken = escapeHtml(token || '');
  const safeName = escapeHtml(user?.name ?? '');
  const safeEmail = escapeHtml(user?.email ?? '');
  const safeRegNo = escapeHtml(user?.verification?.registrationNo ?? '');

  const submittedAt = user?.verification?.submittedAt
    ? new Date(user.verification.submittedAt).toLocaleString()
    : '';
  const safeSubmittedAt = escapeHtml(submittedAt);

  const verb = action === 'approve' ? 'Approve' : 'Reject';
  const buttonColor = action === 'approve' ? '#16a34a' : '#dc2626';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      body { font-family: -apple-system, system-ui, sans-serif; background: #f7f7f8; color: #111; margin: 0; padding: 40px 16px; }
      .card { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); padding: 32px; }
      h2 { margin: 0 0 8px; font-size: 22px; }
      p { color: #444; line-height: 1.5; font-size: 14px; }
      .meta { background: #f3f4f6; border-radius: 8px; padding: 12px 14px; margin: 16px 0; font-size: 13px; }
      .meta strong { display: inline-block; min-width: 110px; color: #555; }
      button { width: 100%; padding: 14px 18px; background: ${buttonColor}; color: #fff; border: 0; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; }
      button:hover { filter: brightness(0.95); }
      .cancel { display: block; margin-top: 12px; text-align: center; color: #666; text-decoration: none; font-size: 13px; }
      .cancel:hover { color: #111; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>${safeTitle}</h2>
      <p>You are about to <strong>${safeAction}</strong> this student's ID verification. Please review the details below before confirming.</p>
      <div class="meta">
        <div><strong>Name:</strong> ${safeName}</div>
        <div><strong>Email:</strong> ${safeEmail}</div>
        <div><strong>Reg. no:</strong> ${safeRegNo || '—'}</div>
        <div><strong>Submitted:</strong> ${safeSubmittedAt || '—'}</div>
      </div>
      <form method="POST" action="${escapeHtml(postUrl)}">
        <input type="hidden" name="token" value="${safeToken}" />
        <input type="hidden" name="action" value="${safeAction}" />
        <input type="hidden" name="reason" value="" />
        <button type="submit">Confirm ${escapeHtml(verb)}</button>
        <a class="cancel" href="${escapeHtml(process.env.CLIENT_URL || 'http://localhost:5173')}/admin">Cancel and review on dashboard</a>
      </form>
    </div>
  </body>
</html>`;
}

function renderResult(title, message) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>${safeTitle}</title></head>
  <body style="font-family: sans-serif; max-width: 480px; margin: 80px auto; text-align: center;">
    <h2>${safeTitle}</h2>
    <p>${safeMessage}</p>
  </body>
</html>`;
}

// GET /api/admin/verify-via-email?token=...&action=approve|reject
// Renders ONLY a confirmation HTML page — no state mutation. The actual
// decision is applied by the POST endpoint below.
export const verifyViaEmail = asyncHandler(async (req, res) => {
  const { token, action } = req.query;

  if (!['approve', 'reject'].includes(action) || !token || typeof token !== 'string') {
    return res
      .status(400)
      .send(renderResult('Invalid link', 'This verification link is malformed.'));
  }

  const tokenHash = hashVerificationToken(token);
  const user = await User.findOne({
    'verification.verificationTokenHash': tokenHash,
    'verification.verificationTokenExpires': { $gt: new Date() }
  }).select('+verification.verificationTokenHash +verification.verificationTokenExpires');

  if (!user) {
    return res
      .status(200)
      .send(
        renderResult(
          'Link expired or already used',
          'This approval link is no longer valid. Please use the admin dashboard instead.'
        )
      );
  }

  if (user.verification.status !== 'pending') {
    const msg = `This submission was already marked as "${user.verification.status}".`;
    return res.status(200).send(renderResult('Already reviewed', msg));
  }

  // Render the confirmation page — every user-controlled value is escaped
  // by buildConfirmationPage, so even a registered `<script>` name shows
  // up as inert text. (QD-002 stored-XSS fix.)
  const postUrl = '/api/admin/verifications/review-by-token';
  const title = action === 'approve' ? 'Approve verification?' : 'Reject verification?';
  res.status(200).send(buildConfirmationPage({ title, action, user, token, postUrl }));
});

// POST /api/admin/verifications/review-by-token
// body: { token, action, reason? }
// Authenticates via the single-use email token (no JWT required — this is
// the one-click email-link flow). The global CSRF middleware EXEMPTS this
// endpoint (see middleware/csrf.js) because:
//   1. There is no cookie auth → no CSRF attack vector (the browser would
//      not auto-attach credentials).
//   2. The endpoint is the target of a browser-rendered HTML form on the
//      GET /verify-via-email confirmation page; HTML forms cannot set
//      custom headers like X-Requested-With.
// An attacker would need to know the 64-char random single-use token
// (delivered only via admin email) to construct a forged POST.
export const reviewVerificationByToken = asyncHandler(async (req, res) => {
  const { token, action, reason } = req.body;

  if (!token || typeof token !== 'string') {
    res.status(400);
    throw new Error('Token is required');
  }
  if (!['approve', 'reject'].includes(action)) {
    res.status(400);
    throw new Error('action must be "approve" or "reject"');
  }

  const tokenHash = hashVerificationToken(token);
  const user = await User.findOne({
    'verification.verificationTokenHash': tokenHash,
    'verification.verificationTokenExpires': { $gt: new Date() }
  }).select('+verification.verificationTokenHash +verification.verificationTokenExpires');

  if (!user) {
    res.status(400);
    throw new Error('This verification link is invalid or expired. Please use the admin dashboard instead.');
  }
  if (user.verification.status !== 'pending') {
    res.status(400);
    throw new Error(`This submission was already marked as "${user.verification.status}".`);
  }

  await applyVerificationDecision({
    user,
    action,
    reason,
    via: 'email_link',
    actorUserId: null,
    req
  });

  const verb = action === 'approve' ? 'Approved' : 'Rejected';
  const msg = `${user.name} (${user.email}) has been ${user.verification.status}.`;
  res.status(200).send(renderResult(verb, msg));
});

// GET /api/admin/stats
export const getAdminStats = asyncHandler(async (req, res) => {
  const [pending, approved, rejected, totalStudents, viaDashboard, viaEmailLink] = await Promise.all([
    User.countDocuments({ 'verification.status': 'pending' }),
    User.countDocuments({ 'verification.status': 'approved' }),
    User.countDocuments({ 'verification.status': 'rejected' }),
    User.countDocuments({ role: 'student' }),
    User.countDocuments({ 'verification.reviewedVia': 'dashboard' }),
    User.countDocuments({ 'verification.reviewedVia': 'email_link' })
  ]);
  res.json({
    pending,
    approved,
    rejected,
    totalStudents,
    reviewedVia: { dashboard: viaDashboard, email_link: viaEmailLink }
  });
});

// GET /api/admin/audit-log?page=&limit=&targetUserId=&action=
// QD-015 — paginated, read-only viewer for the append-only audit log.
export const listAuditLog = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const filter = {};
  if (req.query.targetUserId) {
    filter.targetUserId = req.query.targetUserId;
  }
  if (req.query.action && ['approve', 'reject'].includes(req.query.action)) {
    filter.action = req.query.action;
  }

  const [rows, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('actorUserId', 'name email')
      .populate('targetUserId', 'name email'),
    AuditLog.countDocuments(filter)
  ]);

  res.json({
    rows,
    total,
    page,
    pages: Math.ceil(total / limit)
  });
});
