import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CalendarClockIcon,
  CheckIcon,
  Loader2Icon,
  MapPinIcon,
  ShieldCheckIcon } from
'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useCart } from '../context/CartContext';
import { api } from '../utils/api';
import { formatPrice } from '../utils/format';

// Rounds "now" up to the next 30-minute mark, formatted for a
// datetime-local input's min attribute — buyers can't request a
// pickup time in the past.
function minDateTimeLocal() {
  const d = new Date(Date.now() + 30 * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function Checkout() {
  const { items, refreshCart } = useCart();
  const navigate = useNavigate();

  const [location, setLocation] = useState('');
  const [time, setTime] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const minTime = useMemo(minDateTimeLocal, []);

  const groups = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      const key = item.seller.id;
      if (!map.has(key)) map.set(key, { seller: item.seller, items: [] });
      map.get(key).items.push(item);
    }
    return Array.from(map.values());
  }, [items]);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (items.length === 0 && status !== 'done') {
    return (
      <div className="flex min-h-screen w-full flex-col bg-ink-950">
        <Navbar />
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-5 py-16 text-center">
          <p className="text-base font-semibold text-chalk">Your cart is empty</p>
          <p className="mt-2 text-sm text-chalk-muted">Add something first, then come back to checkout.</p>
          <Link
            to="/#feed"
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-acid px-4 py-2 text-sm font-semibold text-ink-950 transition-transform duration-150 ease-smooth hover:scale-[1.03]">
            
            Browse the board
          </Link>
        </main>
        <Footer />
      </div>);

  }

  const handleConfirm = async (event) => {
    event.preventDefault();
    setError(null);

    if (!location.trim()) {
      setError('Add where you want to receive your order.');
      return;
    }
    if (!time) {
      setError('Pick a date and time.');
      return;
    }

    setStatus('loading');
    try {
      await api.createOrders({ deliveryLocation: location.trim(), deliveryTime: new Date(time).toISOString() });
      setStatus('done');
      toast.success('Request sent to seller(s)');
      await refreshCart();
      window.setTimeout(() => navigate('/orders'), 700);
    } catch (err) {
      setStatus('idle');
      setError(err.message);
      toast.error(err.message);
    }
  };

  return (
    <div className="min-h-screen w-full bg-ink-950">
      <Navbar />

      <main className="mx-auto w-full max-w-2xl px-5 py-12 lg:px-8 lg:py-16">
        <Link
          to="/cart"
          className="inline-flex items-center gap-1.5 text-sm text-chalk-muted transition-colors duration-150 ease-smooth hover:text-chalk">
          
          <ArrowLeftIcon className="h-4 w-4" />
          Back to cart
        </Link>

        <h1 className="mt-6 text-3xl font-extrabold tracking-[-0.02em] text-chalk sm:text-4xl">
          Checkout
        </h1>
        <p className="mt-3 text-[15px] text-chalk-muted">
          This sends a request to each seller — they'll accept or decline
          before anything's final. No payment happens here.
        </p>

        <div className="mt-8 flex flex-col gap-4">
          {groups.map((group) =>
          <div key={group.seller.id} className="rounded-card border border-ink-700 bg-ink-850 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-chalk-muted">
                Request to
                <span className="flex items-center gap-1 text-chalk">
                  {group.seller.name}
                  {group.seller.verified &&
                <ShieldCheckIcon className="h-3.5 w-3.5 text-sky" aria-label="Verified student" />
                }
                </span>
              </p>
              <ul className="mt-3 divide-y divide-ink-700/70">
                {group.items.map((item) =>
              <li key={item.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <img src={item.image} alt={item.title} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                    <span className="min-w-0 flex-1 truncate text-chalk">{item.title}</span>
                    <span className="shrink-0 text-chalk-dim">× {item.quantity}</span>
                    <span className="shrink-0 font-semibold text-acid">{formatPrice(item.price * item.quantity)}</span>
                  </li>
              )}
              </ul>
            </div>
          )}
        </div>

        <form onSubmit={handleConfirm} className="mt-8 space-y-5">
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-chalk">
              Where should sellers meet you?
            </label>
            <div className="relative mt-2">
              <MapPinIcon className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-chalk-dim" />
              <input
                id="location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Hillcrest lobby"
                className="w-full rounded-xl border border-ink-600 bg-ink-850 py-3 pl-11 pr-4 text-[15px] text-chalk placeholder:text-chalk-dim transition-colors duration-150 ease-smooth hover:border-ink-500 focus:border-acid focus:outline-none" />
              
            </div>
          </div>

          <div>
            <label htmlFor="time" className="block text-sm font-medium text-chalk">
              What time works for you?
            </label>
            <div className="relative mt-2">
              <CalendarClockIcon className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-chalk-dim" />
              <input
                id="time"
                type="datetime-local"
                min={minTime}
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-xl border border-ink-600 bg-ink-850 py-3 pl-11 pr-4 text-[15px] text-chalk transition-colors duration-150 ease-smooth hover:border-ink-500 focus:border-acid focus:outline-none" />
              
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-ink-900 px-4 py-3.5 text-sm">
            <span className="text-chalk-muted">Total across all sellers</span>
            <span className="font-extrabold text-acid">{formatPrice(subtotal)}</span>
          </div>

          {error &&
          <p className="flex items-start gap-2 rounded-xl bg-rose/10 px-3.5 py-3 text-sm text-rose">
              <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          }

          <button
            type="submit"
            disabled={status !== 'idle'}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-acid px-6 py-3.5 text-[15px] font-semibold text-ink-950 transition-transform duration-150 ease-smooth hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100">
            
            {status === 'loading' && <Loader2Icon className="h-4 w-4 animate-spin" />}
            {status === 'done' && <CheckIcon className="h-4 w-4" />}
            {status === 'idle' ?
            'Confirm and send request' :
            status === 'loading' ? 'Sending…' : 'Sent — opening your requests'}
          </button>
        </form>
      </main>

      <Footer />
    </div>);

}
