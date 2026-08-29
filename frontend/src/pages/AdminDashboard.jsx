import React, { useEffect, useState } from 'react';
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ClockIcon,
  FileTextIcon,
  MailIcon,
  LayoutDashboardIcon,
  PhoneIcon,
  XCircleIcon } from
'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Avatar } from '../components/Avatar';
import { api } from '../utils/api';
import { getInitials, formatRelativeTime } from '../utils/format';

const TABS = [
{ id: 'pending', label: 'Pending' },
{ id: 'approved', label: 'Approved' },
{ id: 'rejected', label: 'Rejected' },
// QD-015 — audit log tab so admins can see every verification action.
{ id: 'audit', label: 'Audit log' }];


// Small pill showing which surface a decision was made from. Undefined
// for anything reviewed before the reviewedVia field existed, or for
// submissions that haven't been reviewed yet — both render as null.
function ReviewedViaBadge({ reviewedVia }) {
  if (!reviewedVia) return null;
  const isDashboard = reviewedVia === 'dashboard';
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ink-800 px-2 py-0.5 text-[11px] font-medium text-chalk-dim">
      {isDashboard ?
      <LayoutDashboardIcon className="h-3 w-3" /> :

      <MailIcon className="h-3 w-3" />
      }
      {isDashboard ? 'Reviewed on dashboard' : 'Reviewed via email link'}
    </span>);

}

function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-tangerine/12 text-tangerine',
    approved: 'bg-sky/12 text-sky',
    rejected: 'bg-rose/12 text-rose'
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${styles[status] || 'bg-ink-800 text-chalk-dim'}`}>
      {status}
    </span>);

}

function StatCard({ label, value }) {
  return (
    <div className="rounded-card border border-ink-700 bg-ink-850 px-5 py-4">
      <p className="text-2xl font-extrabold tracking-[-0.02em] text-chalk">{value}</p>
      <p className="mt-1 text-sm text-chalk-muted">{label}</p>
    </div>);

}

function VerificationCard({ item, onReview, actioning }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const isPending = item.status === 'pending';
  const busy = actioning === item.userId;

  return (
    <div className="flex flex-col gap-4 rounded-card border border-ink-700 bg-ink-850 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Avatar initials={getInitials(item.name)} accent="grape" />
          <div>
            <p className="text-sm font-semibold text-chalk">{item.name}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-chalk-muted">
              <MailIcon className="h-3.5 w-3.5" />
              {item.email}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-chalk-muted">
              <PhoneIcon className="h-3.5 w-3.5" />
              {item.phone}
            </p>
          </div>
        </div>
        <StatusBadge status={item.status} />
      </div>

      <dl className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-chalk-dim">Registration no.</dt>
          <dd className="mt-0.5 font-medium text-chalk">{item.registrationNo || '—'}</dd>
        </div>
        <div>
          <dt className="text-chalk-dim">Submitted</dt>
          <dd className="mt-0.5 flex items-center gap-1 font-medium text-chalk">
            <ClockIcon className="h-3.5 w-3.5" />
            {formatRelativeTime(item.submittedAt)}
          </dd>
        </div>
      </dl>

      <div className="grid grid-cols-2 gap-3">
        {item.idCardViewUrl &&
        <a
          href={item.idCardViewUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-ink-600 py-2.5 text-xs font-medium text-chalk-muted transition-colors duration-150 ease-smooth hover:border-ink-500 hover:text-chalk">
          
            <FileTextIcon className="h-3.5 w-3.5" />
            View ID card
          </a>
        }
        {item.aadharCardViewUrl &&
        <a
          href={item.aadharCardViewUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-ink-600 py-2.5 text-xs font-medium text-chalk-muted transition-colors duration-150 ease-smooth hover:border-ink-500 hover:text-chalk">
          
            <FileTextIcon className="h-3.5 w-3.5" />
            View Aadhar card
          </a>
        }
      </div>

      {!isPending &&
      <div className="flex flex-wrap items-center gap-2">
          <ReviewedViaBadge reviewedVia={item.reviewedVia} />
          {item.reviewedAt &&
        <span className="text-[11px] text-chalk-dim">
              {formatRelativeTime(item.reviewedAt)}
            </span>
        }
        </div>
      }

      {isPending &&
      <div className="mt-1 flex flex-col gap-2">
          {rejecting &&
        <input
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for rejection (optional)"
          className="w-full rounded-xl border border-ink-600 bg-ink-900 px-3 py-2 text-xs text-chalk placeholder:text-chalk-dim focus:border-acid focus:outline-none" />

        }
          <div className="flex gap-2">
            <button
            type="button"
            disabled={busy}
            onClick={() => onReview(item.userId, 'approve')}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-acid px-4 py-2 text-xs font-semibold text-ink-950 transition-transform duration-150 ease-smooth hover:scale-[1.02] disabled:opacity-50">
            
              <CheckCircle2Icon className="h-3.5 w-3.5" />
              Approve
            </button>
            {rejecting ?
          <button
            type="button"
            disabled={busy}
            onClick={() => onReview(item.userId, 'reject', reason)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-rose px-4 py-2 text-xs font-semibold text-ink-950 transition-transform duration-150 ease-smooth hover:scale-[1.02] disabled:opacity-50">
            
                <XCircleIcon className="h-3.5 w-3.5" />
                Confirm reject
              </button> :

          <button
            type="button"
            disabled={busy}
            onClick={() => setRejecting(true)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-ink-600 px-4 py-2 text-xs font-medium text-chalk-muted transition-colors duration-150 ease-smooth hover:border-rose/60 hover:text-rose disabled:opacity-50">
            
                <XCircleIcon className="h-3.5 w-3.5" />
                Reject
              </button>
          }
          </div>
        </div>
      }
    </div>);

}

export function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState('pending');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actioning, setActioning] = useState(null);

  const loadStats = () => {
    api.getAdminStats().then(setStats).catch(() => {});
  };

  const loadList = (status) => {
    setLoading(true);
    setError(null);
    // QD-015 — the 'audit' tab fetches from the audit-log endpoint,
    // not the verifications endpoint.
    if (status === 'audit') {
      api.getAuditLog({ page: 1, limit: 25 }).
        then((res) => setItems(res.rows || [])).
        catch((err) => setError(err.message)).
        finally(() => setLoading(false));
      return;
    }
    api.
    getAdminVerifications(status).
    then((res) => setItems(res.verifications)).
    catch((err) => setError(err.message)).
    finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    loadList(tab);
  }, [tab]);

  const handleReview = async (userId, action, reason) => {
    setActioning(userId);
    setError(null);
    try {
      await api.reviewVerification(userId, action, reason);
      // Reviewed items leave the pending list — drop it locally rather
      // than waiting on a refetch so the card disappears immediately.
      setItems((prev) => prev.filter((i) => i.userId !== userId));
      loadStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setActioning(null);
    }
  };

  return (
    <div className="min-h-screen w-full bg-ink-950">
      <Navbar />

      <main className="mx-auto w-full max-w-[1240px] px-5 py-12 lg:px-8 lg:py-16">
        <header>
          <h1 className="text-3xl font-extrabold tracking-[-0.02em] text-chalk sm:text-4xl">
            Verification review
          </h1>
          <p className="mt-2 text-[15px] text-chalk-muted">
            Review student ID and Aadhar submissions. Decisions made here or
            via the one-click email link are both logged for audit purposes.
          </p>
        </header>

        {stats &&
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Pending" value={stats.pending} />
            <StatCard label="Approved" value={stats.approved} />
            <StatCard label="Rejected" value={stats.rejected} />
            <StatCard label="Total students" value={stats.totalStudents} />
          </div>
        }

        {stats?.reviewedVia &&
        <p className="mt-3 text-xs text-chalk-dim">
            Reviewed to date — dashboard: {stats.reviewedVia.dashboard} · email link: {stats.reviewedVia.email_link}
          </p>
        }

        <div className="mt-10 border-b border-ink-700/70">
          <div role="tablist" aria-label="Verification status" className="no-scrollbar -mb-px flex gap-7 overflow-x-auto">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 border-b-2 pb-3.5 text-sm font-semibold transition-colors duration-150 ease-smooth ${
                  active ?
                  'border-acid text-chalk' :
                  'border-transparent text-chalk-muted hover:text-chalk'}`
                  }>
                  
                  {t.label}
                </button>);

            })}
          </div>
        </div>

        {error &&
        <div className="mt-8 flex items-start gap-2 rounded-xl bg-rose/10 px-4 py-3 text-sm text-rose">
            <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        }

        {loading ?
        <div className="mt-10 rounded-card border border-dashed border-ink-600 px-6 py-16 text-center">
            <p className="text-sm text-chalk-muted">Loading…</p>
          </div> :
        items.length === 0 ?
        <div className="mt-10 rounded-card border border-dashed border-ink-600 px-6 py-16 text-center">
            <p className="text-base font-semibold text-chalk">Nothing here</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-chalk-muted">
              {tab === 'pending' ?
            'No submissions are waiting on review right now.' :
            tab === 'audit' ?
            'No audit log entries yet.' :
            `No submissions have been ${tab} yet.`}
            </p>
          </div> :

        // QD-015 — Audit log tab renders a table; other tabs render cards.
        tab === 'audit' ?
        <div className="mt-10 overflow-x-auto rounded-card border border-ink-700">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-700 bg-ink-850 text-chalk-muted">
              <tr>
                <th className="px-4 py-3 font-medium">At</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Via</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Target</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row._id} className="border-b border-ink-700/50">
                  <td className="px-4 py-3 text-chalk-muted">{row.at ? new Date(row.at).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={row.action === 'approve' ? 'text-sky' : 'text-rose'}>
                      {row.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-chalk-muted">{row.via}</td>
                  <td className="px-4 py-3 text-chalk">{row.actorUserId?.name || row.actorUserId?.email || 'email-link'}</td>
                  <td className="px-4 py-3 text-chalk">{row.targetUserId?.name || row.targetUserId?.email || String(row.targetUserId)}</td>
                  <td className="px-4 py-3 text-chalk-muted">{row.reason || '—'}</td>
                  <td className="px-4 py-3 text-chalk-muted">{row.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div> :

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) =>
          <VerificationCard
            key={item.userId}
            item={item}
            onReview={handleReview}
            actioning={actioning} />

          )}
          </div>
        }
      </main>

      <Footer />
    </div>);

}