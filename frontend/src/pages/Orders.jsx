import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  AlertCircleIcon,
  CalendarClockIcon,
  CheckIcon,
  ClockIcon,
  Loader2Icon,
  MapPinIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  StarIcon,
  XIcon
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { ReviewModal } from '../components/ReviewModal';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { formatPrice } from '../utils/format';
import { getSocket } from '../utils/socket';

function formatDateTime(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

const STATUS_STYLES = {
  pending: 'bg-tangerine/12 text-tangerine',
  accepted: 'bg-acid/15 text-acid',
  rejected: 'bg-rose/12 text-rose',
  cancelled: 'bg-ink-700 text-chalk-dim',
  completed: 'bg-sky/12 text-sky'
};

function OrderCard({ order, mode, onAccept, onReject, onCancel, onComplete, onReview, busy }) {
  const { t } = useTranslation();
  const counterparty = mode === 'received' ? order.buyer : order.seller;
  const total = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <li className="rounded-card border border-ink-700 bg-ink-850 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm">
          <span className="text-chalk-muted">{mode === 'received' ? t('orders.from') : t('orders.to')}</span>
          <span className="font-semibold text-chalk">
            {counterparty?.name || 'Former student'}
          </span>
          {counterparty?.verification?.status === 'approved' && (
            <ShieldCheckIcon className="h-3.5 w-3.5 text-sky" aria-label="Verified student" />
          )}
        </p>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${
            STATUS_STYLES[order.status] || 'bg-ink-700 text-chalk-dim'
          }`}
        >
          {order.status}
        </span>
      </div>

      <ul className="mt-3 divide-y divide-ink-700/70">
        {order.items.map((item, i) => (
          <li key={i} className="flex items-center gap-3 py-2 text-sm">
            <img
              src={item.listing?.images?.[0]?.url || '/vite.svg'}
              alt={item.title}
              className="h-10 w-10 shrink-0 rounded-lg object-cover"
            />
            <span className="min-w-0 flex-1 truncate text-chalk">{item.title}</span>
            <span className="shrink-0 text-chalk-dim">× {item.quantity}</span>
            <span className="shrink-0 font-semibold text-acid">
              {formatPrice(item.price * item.quantity)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-chalk-muted">
        <span className="flex items-center gap-1.5">
          <MapPinIcon className="h-3.5 w-3.5" />
          {order.deliveryLocation}
        </span>
        <span className="flex items-center gap-1.5">
          <CalendarClockIcon className="h-3.5 w-3.5" />
          {formatDateTime(order.deliveryTime)}
        </span>
        <span className="font-semibold text-chalk">{formatPrice(total)} {t('orders.total')}</span>
      </div>

      {/* Actions */}
      {order.status === 'pending' && (
        <div className="mt-4 flex gap-2">
          {mode === 'received' ? (
            <>
              <button
                type="button"
                onClick={() => onAccept(order._id)}
                disabled={busy}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-acid px-3 py-2 text-xs font-bold text-ink-950 transition-transform hover:scale-[1.02] disabled:opacity-70"
              >
                <CheckIcon className="h-3.5 w-3.5" />
                {t('orders.accept')}
              </button>
              <button
                type="button"
                onClick={() => onReject(order._id)}
                disabled={busy}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-ink-600 px-3 py-2 text-xs font-semibold text-chalk transition-colors hover:border-rose hover:text-rose disabled:opacity-70"
              >
                <XIcon className="h-3.5 w-3.5" />
                {t('orders.decline')}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onCancel(order._id)}
              disabled={busy}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-ink-600 px-3 py-2 text-xs font-semibold text-chalk transition-colors hover:border-rose hover:text-rose disabled:opacity-70"
            >
              <XIcon className="h-3.5 w-3.5" />
              {t('orders.cancelRequest')}
            </button>
          )}
        </div>
      )}

      {/* Buyer can mark accepted orders as completed (unlocks reviews) */}
      {order.status === 'accepted' && mode === 'sent' && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => onComplete(order._id)}
            disabled={busy}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-sky px-3 py-2 text-xs font-bold text-ink-950 transition-transform hover:scale-[1.02] disabled:opacity-70"
          >
            <CheckIcon className="h-3.5 w-3.5" />
            {t('orders.markComplete')}
          </button>
          <button
            type="button"
            onClick={() => onCancel(order._id)}
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-ink-600 px-3 py-2 text-xs font-semibold text-chalk transition-colors hover:border-rose hover:text-rose disabled:opacity-70"
          >
            <XIcon className="h-3.5 w-3.5" />
            {t('common.cancel')}
          </button>
        </div>
      )}

      {/* Completed orders from sent tab can be reviewed */}
      {order.status === 'completed' && mode === 'sent' && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => onReview(order)}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-acid px-3 py-2 text-xs font-semibold text-acid transition-colors hover:bg-acid hover:text-ink-950"
          >
            <StarIcon className="h-3.5 w-3.5" />
            {t('review.leaveReview')}
          </button>
        </div>
      )}
    </li>
  );
}

export function Orders() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [tab, setTab] = useState('received');
  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  // Order being reviewed in the ReviewModal (null = closed).
  const [reviewOrder, setReviewOrder] = useState(null);

  const isVerified = user?.verificationStatus === 'approved';

  const load = () => {
    if (!isVerified) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([api.getReceivedOrders(), api.getMyOrders()])
      .then(([receivedRes, sentRes]) => {
        setReceived(receivedRes.orders);
        setSent(sentRes.orders);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [isVerified]);

  // Listen for real-time order updates via Socket.io.
  useEffect(() => {
    if (!isVerified || !user) return;
    const socket = getSocket();
    if (!socket) return;

    const handleOrderUpdate = () => {
      // Refetch the lists so the new status shows up immediately.
      load();
    };

    socket.on('order:update', handleOrderUpdate);
    return () => {
      socket.off('order:update', handleOrderUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVerified, user]);

  const handleAccept = async (id) => {
    setBusyId(id);
    try {
      await api.acceptOrder(id);
      toast.success(t('orders.orderAccepted'));
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id) => {
    setBusyId(id);
    try {
      await api.rejectOrder(id);
      toast.success(t('orders.orderDeclined'));
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (id) => {
    setBusyId(id);
    try {
      await api.cancelOrder(id);
      toast.success(t('orders.orderCancelled'));
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleComplete = async (id) => {
    setBusyId(id);
    try {
      await api.completeOrder(id);
      toast.success(t('notifications.orderCompleted'));
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const list = tab === 'received' ? received : sent;
  const tabs = [
    { id: 'received', label: t('orders.received'), count: received.length },
    { id: 'sent', label: t('orders.sent'), count: sent.length }
  ];

  return (
    <div className="flex min-h-screen w-full flex-col bg-ink-950">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12 lg:px-8 lg:py-16">
        <h1 className="text-3xl font-extrabold tracking-[-0.02em] text-chalk sm:text-4xl">
          {t('orders.title')}
        </h1>

        {!isVerified ? (
          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-ink-700 bg-ink-850 p-5">
            <ShieldAlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-tangerine" />
            <div>
              <p className="text-sm font-semibold text-chalk">
                {t('orders.verifyToSee')}
              </p>
              <Link
                to="/verify"
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-acid px-4 py-2 text-sm font-semibold text-ink-950 transition-transform hover:scale-[1.03]"
              >
                {t('orders.verifyYourId')}
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-8 border-b border-ink-700/70">
              <div
                role="tablist"
                aria-label="Order sections"
                className="no-scrollbar -mb-px flex gap-7 overflow-x-auto"
              >
                {tabs.map((t) => {
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setTab(t.id)}
                      className={`shrink-0 border-b-2 pb-3.5 text-sm font-semibold transition-colors ${
                        active
                          ? 'border-acid text-chalk'
                          : 'border-transparent text-chalk-muted hover:text-chalk'
                      }`}
                    >
                      {t.label}
                      <span className="ml-1.5 font-normal text-chalk-dim">{t.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <p className="mt-6 flex items-start gap-2 rounded-xl bg-rose/10 px-4 py-3 text-sm text-rose">
                <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            {loading ? (
              <div className="mt-10 flex items-center justify-center rounded-card border border-dashed border-ink-600 px-6 py-16">
                <Loader2Icon className="h-5 w-5 animate-spin text-chalk-dim" />
              </div>
            ) : list.length === 0 ? (
              <div className="mt-10 rounded-card border border-dashed border-ink-600 px-6 py-16 text-center">
                <ClockIcon className="mx-auto h-8 w-8 text-chalk-dim" />
                <p className="mt-3 text-base font-semibold text-chalk">{t('orders.nothingHere')}</p>
                <p className="mx-auto mt-2 max-w-sm text-sm text-chalk-muted">
                  {tab === 'received' ? t('orders.receivedBody') : t('orders.sentBody')}
                </p>
              </div>
            ) : (
              <ul className="mt-6 flex flex-col gap-4">
                {list.map((order) => (
                  <OrderCard
                    key={order._id}
                    order={order}
                    mode={tab}
                    onAccept={handleAccept}
                    onReject={handleReject}
                    onCancel={handleCancel}
                    onComplete={handleComplete}
                    onReview={setReviewOrder}
                    busy={busyId === order._id}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </main>
      {reviewOrder && (
        <ReviewModal
          order={reviewOrder}
          onClose={() => setReviewOrder(null)}
          onSubmitted={load}
        />
      )}
      <Footer />
    </div>
  );
}
