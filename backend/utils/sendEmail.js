import nodemailer from 'nodemailer';
import { sendEmail as sendEmailQueued } from './emailQueue.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined
  });
  return transporter;
}

// QD-027 — sendEmail now delegates to the BullMQ-backed emailQueue
// helper. If REDIS_URL is configured, the email is enqueued and the
// HTTP response returns immediately. Otherwise, the queue helper
// falls back to inline send (the original behavior) so local dev
// without Redis still works.
//
// We keep the inline `getTransporter` for the emailQueue worker to
// reuse — see utils/emailQueue.js.
export async function sendEmail(payload) {
  return sendEmailQueued(payload);
}

// Exported so emailQueue.js can reuse it without re-creating the
// transporter.
export { getTransporter };

export function otpEmail(code) {
  return {
    subject: 'Your Quad verification code',
    text: `Your Quad verification code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
    html: `<p>Your Quad verification code is <strong style="font-size:20px;letter-spacing:4px;">${code}</strong>.</p><p>It expires in 10 minutes. If you didn't request this, you can ignore this email.</p>`
  };
}

export function verificationSubmittedEmail(user, { approveUrl, rejectUrl }) {
  return {
    subject: 'New student verification submitted',
    text: `${user.name} (${user.email}) submitted a student ID for verification.
Registration no: ${user.verification.registrationNo}

Approve: ${approveUrl}
Reject:  ${rejectUrl}

These links expire in 72 hours. For a closer look at the submitted ID/Aadhar images first, use the admin dashboard instead.`,
    html: `<p><strong>${escapeHtml(user.name)}</strong> (${escapeHtml(user.email)}) submitted a student ID for verification.</p>
<p>Registration no: ${escapeHtml(user.verification.registrationNo)}</p>
<p>
  <a href="${approveUrl}" style="display:inline-block;padding:10px 18px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;margin-right:8px;">Approve</a>
  <a href="${rejectUrl}" style="display:inline-block;padding:10px 18px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;">Reject</a>
</p>
<p style="color:#666;font-size:13px;">These links expire in 72 hours. For a closer look at the submitted ID/Aadhar images first, use the admin dashboard instead.</p>`
  };
}

// Sent to the student when an admin approves/rejects their ID submission.
export function verificationResultEmail(user, { status, reason }) {
  if (status === 'approved') {
    return {
      subject: 'Your Quad verification is approved',
      text: `Hi ${user.name},\n\nGreat news — your student ID has been verified. You can now post listings, message other students, and use the cart on Quad.\n\nThanks for keeping the marketplace safe.`,
      html: `<p>Hi ${escapeHtml(user.name)},</p><p>Great news — your student ID has been <strong>verified</strong>. You can now post listings, message other students, and use the cart on Quad.</p><p>Thanks for keeping the marketplace safe.</p>`
    };
  }
  return {
    subject: 'Your Quad verification needs attention',
    text: `Hi ${user.name},\n\nWe weren't able to approve your student ID submission.\n\nReason: ${reason || 'Not specified'}\n\nYou can resubmit your documents at any time by signing in and visiting the verification page.`,
    html: `<p>Hi ${escapeHtml(user.name)},</p><p>We weren't able to approve your student ID submission.</p><p><strong>Reason:</strong> ${escapeHtml(reason || 'Not specified')}</p><p>You can resubmit your documents at any time by signing in and visiting the verification page.</p>`
  };
}

// Password reset email — contains the one-time reset link.
export function passwordResetEmail(user, resetUrl) {
  return {
    subject: 'Reset your Quad password',
    text: `Hi ${user.name},\n\nWe received a request to reset your Quad password. Click the link below to choose a new one:\n\n${resetUrl}\n\nThis link expires in 30 minutes. If you didn't ask to reset your password, you can safely ignore this email — your account is still secure.`,
    html: `<p>Hi ${escapeHtml(user.name)},</p><p>We received a request to reset your Quad password. Click the button below to choose a new one:</p>
<p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#CDFF4B;color:#07070A;text-decoration:none;border-radius:8px;font-weight:600;">Reset password</a></p>
<p style="color:#666;font-size:13px;">This link expires in 30 minutes. If you didn't ask to reset your password, you can safely ignore this email — your account is still secure.</p>`
  };
}

// Order notification — sent to the other party when an order's status changes.
export function orderNotificationEmail(recipient, { action, orderSummary, counterpartyName }) {
  const subject =
    action === 'accepted' ? 'Your Quad order was accepted' :
    action === 'rejected' ? 'Your Quad order was declined' :
    action === 'cancelled' ? 'A Quad order was cancelled' :
    'Quad order update';

  const text = action === 'accepted'
    ? `Hi ${recipient.name},\n\n${counterpartyName} accepted your order.\n\n${orderSummary}\n\nContact them through Quad Messages to arrange pickup.`
    : action === 'rejected'
    ? `Hi ${recipient.name},\n\n${counterpartyName} declined your order request.\n\n${orderSummary}\n\nDon't worry — there are plenty of other items on the board.`
    : `Hi ${recipient.name},\n\nAn order was cancelled.\n\n${orderSummary}`;

  return { subject, text, html: `<p>${text.replace(/\n\n/g, '</p><p>')}</p>` };
}

// Exported so adminController can reuse the same escaping when rendering
// inline HTML confirmation pages — QD-002 stored-XSS fix. Every value
// interpolated into an HTML response body MUST go through this helper.
export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}
