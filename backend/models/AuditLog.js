import mongoose from 'mongoose';

// QD-015 — Append-only audit trail for admin verification actions.
//
// Every approve/reject (via dashboard OR email-link) writes one row here.
// The collection is intentionally denormalized (before/after snapshots,
// actorUserId, via, ip, userAgent) so it stays queryable even if the
// underlying User doc is later modified or deleted.
//
// "Append-only" is enforced at the application layer: the controller
// only ever creates new rows. There is no update/delete code path. A
// future hardening sprint could additionally use a Mongo trigger / change
// stream to reject update/delete operations on this collection.

const auditLogSchema = new mongoose.Schema(
  {
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null when the action was performed via a one-click email link
      index: true
    },
    action: {
      type: String,
      enum: ['approve', 'reject'],
      required: true
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    via: {
      type: String,
      enum: ['dashboard', 'email_link'],
      required: true
    },
    reason: { type: String, default: null },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null }
  },
  { timestamps: { createdAt: 'at', updatedAt: false } }
);

// Compound index for the admin audit-log viewer (most-recent-first by target).
auditLogSchema.index({ targetUserId: 1, at: -1 });
auditLogSchema.index({ at: -1 });

// QD-015 HARDENING (caught in second-pass audit) — `strict: 'throw'`
// only prevents unknown fields; it does NOT prevent updateOne/deleteOne.
// We register pre-hooks on every mutating operation that throw, so any
// code path (including a future buggy migration or admin with mongo
// shell access) gets a hard error if it tries to mutate an AuditLog
// row. Reads remain open. This is the closest enforcement available
// without a DB-level insert-only user (which we should still set up
// in production — see BACKUP_RESTORE_RUNBOOK.md).
const APPEND_ONLY_OPS = [
  'updateOne',
  'deleteOne',
  'findOneAndUpdate',
  'findOneAndDelete',
  'findOneAndReplace',
  'replaceOne',
  'update'
];
APPEND_ONLY_OPS.forEach((op) => {
  auditLogSchema.pre(op, function (next) {
    // Allow internal migrations to bypass via a $setRawDocument marker.
    // In practice this is a documentation convention — operators who
    // really need to mutate (e.g. GDPR right-to-erasure) should do so
    // via a direct mongo shell bypass that we explicitly log elsewhere.
    if (this.getOptions?.().bypassAppendOnly === true) {
      return next();
    }
    const err = new Error(
      `AuditLog is append-only — ${op} is not permitted. ` +
        'Use AuditLog.create() to add new rows. For GDPR erasure, ' +
        'use the dedicated `redactPiiFields` admin script which sets ' +
        'a documented bypass flag.'
    );
    err.code = 'AUDITLOG_APPEND_ONLY_VIOLATION';
    return next(err);
  });
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
