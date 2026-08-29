import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheckIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../utils/api';
import { formatPrice } from '../../utils/format';

// Fallback "just listed" sample shown on the landing hero if the API
// call fails or the database is empty (e.g. first deploy). Real listings
// take priority when available.
const FALLBACK_LISTINGS = [
  { _id: 'f1', title: 'Organic Chemistry 8th ed.', price: 45, pickupSpot: 'Science Library', createdAt: new Date(Date.now() - 12 * 60 * 1000), images: [{ url: '/39c584e6-0880-4108-ae1d-abec06aea0f2.jpg' }] },
  { _id: 'f2', title: 'Mini fridge, 3.2 cu ft', price: 60, pickupSpot: 'Hillcrest lobby', createdAt: new Date(Date.now() - 38 * 60 * 1000), images: [{ url: '/964af720-798a-481c-90df-dd817c2b2552.jpg' }] },
  { _id: 'f3', title: '27" 1440p monitor', price: 130, pickupSpot: 'Ellis Engineering', createdAt: new Date(Date.now() - 60 * 60 * 1000), images: [{ url: '/25d3bf21-b887-4bbf-b9dc-7e7dc250ebb8.jpg' }] }
];

function formatAgo(dateInput) {
  const date = new Date(dateInput);
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return `${Math.floor(seconds / 86400)} day ago`;
}

export function Hero({ liveCount = 0 }) {
  const { t } = useTranslation();
  const [justListed, setJustListed] = useState(FALLBACK_LISTINGS);

  useEffect(() => {
    let cancelled = false;
    api.getListings({ limit: 4 })
      .then((data) => {
        if (cancelled) return;
        if (data.listings && data.listings.length > 0) {
          setJustListed(data.listings);
        }
      })
      .catch(() => {
        // Keep fallback — the landing page still looks populated.
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="relative border-b border-ink-700/70">
      <div className="mx-auto grid w-full max-w-[1240px] gap-14 px-5 pb-20 pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-16 lg:px-8 lg:pb-28 lg:pt-24">
        <div>
          <h1 className="max-w-[16ch] text-[44px] font-extrabold leading-[1.02] tracking-[-0.03em] text-chalk sm:text-6xl lg:text-[72px]">
            {t('hero.headline1')}{' '}
            <span className="text-acid">{t('hero.headline2')}</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-chalk-muted">
            {t('hero.subhead')}
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-2">
            {liveCount > 0 && (
              <span className="text-[13px] text-chalk-dim">
                {liveCount.toLocaleString()} {t('hero.itemsLive')}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold text-chalk">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-acid opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-acid" />
              </span>
              {t('hero.justListed')}
            </p>
            <a
              href="#feed"
              className="text-[13px] font-medium text-chalk-muted transition-colors duration-150 ease-smooth hover:text-chalk"
            >
              {t('hero.seeAll')}
            </a>
          </div>

          <ul className="mt-4 divide-y divide-ink-700/80">
            {justListed.slice(0, 4).map((listing, i) => {
              const img = listing.images?.[0]?.url || listing.image;
              return (
                <motion.li
                  key={listing._id || listing.id || i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, delay: i * 0.06, ease: [0.23, 1, 0.32, 1] }}
                  className="flex items-center gap-4 py-3.5"
                >
                  <img
                    src={img}
                    alt={listing.title}
                    className="h-14 w-14 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-chalk">
                      {listing.title}
                    </p>
                    <p className="mt-0.5 text-xs text-chalk-dim">
                      {listing.pickupSpot || listing.pickup} · {formatAgo(listing.createdAt)}
                    </p>
                  </div>
                  <p className="shrink-0 text-base font-bold text-acid">
                    {formatPrice(listing.price)}
                  </p>
                </motion.li>
              );
            })}
          </ul>

          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-ink-850 p-3.5">
            <ShieldCheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-sky" />
            <p className="text-xs leading-relaxed text-chalk-muted">
              {t('hero.trustNote')}{' '}
              <Link
                to="/signup"
                className="font-medium text-chalk underline decoration-ink-500 underline-offset-2 transition-colors duration-150 ease-smooth hover:decoration-acid"
              >
                {t('hero.trustNoteLink')}
              </Link>{' '}
              {t('hero.trustNoteSuffix')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
