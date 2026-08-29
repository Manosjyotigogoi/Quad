import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2Icon, StarIcon, XIcon } from 'lucide-react';
import { api } from '../utils/api';

/**
 * Modal for leaving a seller review after a completed order.
 *
 * The backend only accepts reviews for listings the buyer has a COMPLETED
 * order for, and one review per buyer per listing — it enforces both, so
 * this component just surfaces the server's error messages as toasts.
 *
 * Props:
 * - order: the completed order object ({ items, seller, ... })
 * - onClose(): close without submitting
 * - onSubmitted(): called after a review posts successfully
 */
export function ReviewModal({ order, onClose, onSubmitted }) {
  const { t } = useTranslation();
  const firstFieldRef = useRef(null);

  // An order can contain several items; each is reviewed separately.
  const items = (order.items || []).map((item, i) => ({
    id: item.listing?._id || item.listing,
    title: item.title,
    fallbackKey: i
  }));
  const [listingId, setListingId] = useState(items[0]?.id);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [body, setBody] = useState('');
  const [status, setStatus] = useState('idle'); // idle | submitting
  const [error, setError] = useState(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sellerName = order.seller?.name || '';
  const displayStars = hovered || rating;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (!listingId) {
      setError(t('review.pickItem'));
      return;
    }
    if (rating < 1) {
      setError(t('review.ratingRequired'));
      return;
    }
    if (!body.trim()) {
      setError(t('review.bodyRequired'));
      return;
    }

    setStatus('submitting');
    try {
      await api.createReview({ listingId, rating, body: body.trim() });
      toast.success(t('review.submitted'));
      onSubmitted?.();
      onClose();
    } catch (err) {
      setStatus('idle');
      // e.g. "You can only review a seller after completing an order with
      // them." or the duplicate-review message — show it inline.
      setError(err.message);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={t('review.title')}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-t-2xl border border-ink-700 bg-ink-850 p-6 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-chalk">{t('review.title')}</h2>
            {sellerName && (
              <p className="mt-1 text-sm text-chalk-muted">
                {t('review.ratePrompt', { name: sellerName })}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-chalk-muted transition-colors hover:bg-ink-800 hover:text-chalk"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5">
          {/* Item picker — only shown when the order has several items. */}
          {items.length > 1 && (
            <fieldset className="mb-5">
              <legend className="text-xs font-semibold text-chalk-muted">
                {t('review.pickItem')}
              </legend>
              <div className="styled-scroll mt-2 max-h-36 space-y-1.5 overflow-y-auto pr-1">
                {items.map((item) => (
                  <label
                    key={item.id || item.fallbackKey}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      listingId === item.id
                        ? 'border-acid bg-acid/10 text-chalk'
                        : 'border-ink-600 text-chalk-muted hover:border-ink-500 hover:text-chalk'
                    }`}
                  >
                    <input
                      type="radio"
                      name="review-item"
                      value={item.id}
                      checked={listingId === item.id}
                      onChange={() => setListingId(item.id)}
                      className="h-3.5 w-3.5 accent-acid"
                    />
                    <span className="truncate">{item.title}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {/* Star rating */}
          <div className="flex items-center gap-1.5" role="radiogroup" aria-label={t('review.starsLabel', { rating: displayStars })}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                ref={star === 1 ? firstFieldRef : undefined}
                type="button"
                role="radio"
                aria-checked={rating === star}
                aria-label={t('review.starsLabel', { rating: star })}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setRating(star)}
                className="rounded-md p-1 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-acid"
              >
                <StarIcon
                  className={`h-7 w-7 transition-colors ${
                    star <= displayStars ? 'fill-acid text-acid' : 'text-ink-500'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Review text */}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('review.placeholder')}
            rows={4}
            maxLength={1000}
            className="mt-4 w-full resize-none rounded-xl border border-ink-600 bg-ink-900 px-3.5 py-2.5 text-sm text-chalk placeholder:text-chalk-dim transition-colors hover:border-ink-500 focus:border-acid focus:outline-none"
          />

          {error && (
            <p className="mt-3 rounded-lg bg-rose/10 px-3 py-2 text-xs text-rose">
              {error}
            </p>
          )}

          <div className="mt-5 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border border-ink-600 px-4 py-2.5 text-sm font-semibold text-chalk transition-colors hover:border-ink-500"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={status === 'submitting'}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-acid px-4 py-2.5 text-sm font-bold text-ink-950 transition-transform hover:scale-[1.02] disabled:opacity-70"
            >
              {status === 'submitting' ? (
                <>
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                  {t('review.submitting')}
                </>
              ) : (
                t('review.submit')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
