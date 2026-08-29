import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FilterIcon, Loader2Icon, SearchIcon, XIcon } from 'lucide-react';
import { ListingCard } from '../ListingCard';
import { api } from '../../utils/api';
import { getInitials, formatRelativeTime } from '../../utils/format';

const CONDITIONS = ['New', 'Like new', 'Good', 'Fair'];

// Sort labels resolve through i18n at render time.
function useSortOptions() {
  const { t } = useTranslation();
  return [
    { id: 'newest', label: t('feed.sortNewest') },
    { id: 'price-low', label: t('feed.sortPriceLow') },
    { id: 'price-high', label: t('feed.sortPriceHigh') }
  ];
}

function toCardListing(listing) {
  return {
    id: listing._id,
    title: listing.title,
    price: listing.price,
    wasPrice: listing.wasPrice || undefined,
    condition: listing.condition,
    category: listing.category,
    image: listing.images?.[0]?.url || '/vite.svg',
    seller: {
      id: listing.seller?._id,
      name: listing.seller?.name || 'Former student',
      initials: getInitials(listing.seller?.name),
      campus: listing.seller?.dorm || '',
      rating: listing.seller?.rating,
      verified: listing.seller?.verification?.status === 'approved'
    },
    postedAgo: formatRelativeTime(listing.createdAt),
    pickup: listing.pickupSpot,
    stock: listing.quantity ?? 1,
    watchers: listing.savedBy?.length ?? 0
  };
}

export function MarketFeed() {
  const { t } = useTranslation();
  const SORTS = useSortOptions();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [categories, setCategories] = useState([{ id: 'all', label: t('common.all') }]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  // Advanced filters
  const [showFilters, setShowFilters] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [condition, setCondition] = useState('all');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState('newest');

  const [listings, setListings] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch categories from the API on mount.
  useEffect(() => {
    api.getCategories()
      .then((data) => {
        if (data.categories?.length) {
          setCategories([{ id: 'all', label: t('common.all') }, ...data.categories]);
        }
      })
      .catch(() => {
        // Keep the default All-only list if the API is unreachable.
      });
  }, []);

  // Debounce typing.
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => window.clearTimeout(t);
  }, [query]);

  // Consume the incoming ?q= param once, then drop it from the URL.
  useEffect(() => {
    if (initialQuery && searchParams.has('q')) {
      const next = new URLSearchParams(searchParams);
      next.delete('q');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch listings whenever filters change.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api.getListings({
      category: filter,
      q: debouncedQuery || undefined,
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
      condition,
      verifiedOnly,
      sort,
      limit: 48
    })
      .then((data) => {
        if (cancelled) return;
        setListings(data.listings || []);
        setTotal(data.total ?? data.listings?.length ?? 0);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [filter, debouncedQuery, minPrice, maxPrice, condition, verifiedOnly, sort]);

  const cards = useMemo(() => listings.map(toCardListing), [listings]);

  const hasActiveFilters = minPrice !== '' || maxPrice !== '' || condition !== 'all' || verifiedOnly;
  const clearFilters = () => {
    setMinPrice('');
    setMaxPrice('');
    setCondition('all');
    setVerifiedOnly(false);
  };

  return (
    <section id="feed" className="scroll-mt-20 border-b border-ink-700/70">
      <div className="mx-auto w-full max-w-[1240px] px-5 py-20 lg:px-8 lg:py-24">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-extrabold tracking-[-0.02em] text-chalk sm:text-[40px]">
              {t('feed.title')}
            </h2>
            <p className="mt-3 max-w-xl text-[15px] text-chalk-muted">
              {t('feed.subtitle')}
            </p>
          </div>

          <div className="flex w-full items-center gap-2 md:w-auto">
            <div className="relative w-full md:w-72">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-chalk-dim" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('feed.searchItems')}
                aria-label="Search listings"
                className="w-full rounded-full border border-ink-600 bg-ink-850 py-2.5 pl-10 pr-4 text-sm text-chalk placeholder:text-chalk-dim transition-colors hover:border-ink-500 focus:border-acid focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors ${
                showFilters || hasActiveFilters
                  ? 'border-acid bg-acid/10 text-acid'
                  : 'border-ink-600 text-chalk-muted hover:border-ink-500 hover:text-chalk'
              }`}
              aria-label={t('feed.filters')}
            >
              <FilterIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="mt-4 grid gap-4 rounded-card border border-ink-700 bg-ink-850 p-5 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label htmlFor="feed-min-price" className="block text-xs font-medium text-chalk-muted">{t('feed.minPrice')}</label>
              <input
                id="feed-min-price"
                type="number"
                min="0"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="$0"
                aria-label="Minimum price"
                className="mt-1 w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-chalk placeholder:text-chalk-dim focus:border-acid focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="feed-max-price" className="block text-xs font-medium text-chalk-muted">{t('feed.maxPrice')}</label>
              <input
                id="feed-max-price"
                type="number"
                min="0"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder={t('feed.noLimit')}
                aria-label="Maximum price"
                className="mt-1 w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-chalk placeholder:text-chalk-dim focus:border-acid focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="feed-condition" className="block text-xs font-medium text-chalk-muted">{t('feed.condition')}</label>
              <select
                id="feed-condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                aria-label="Condition"
                className="mt-1 w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-chalk focus:border-acid focus:outline-none"
              >
                <option value="all">{t('feed.allConditions')}</option>
                {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="feed-sort" className="block text-xs font-medium text-chalk-muted">{t('feed.sort')}</label>
              <select
                id="feed-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="Sort by"
                className="mt-1 w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-chalk focus:border-acid focus:outline-none"
              >
                {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-xs text-chalk-muted">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => setVerifiedOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-ink-600 bg-ink-900 accent-acid"
                />
                {t('feed.verifiedOnly')}
              </label>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 text-xs text-chalk-dim transition-colors hover:text-rose"
                >
                  <XIcon className="h-3 w-3" />
                  {t('feed.clear')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Category chips */}
        <div
          role="tablist"
          aria-label="Filter listings by category"
          className="no-scrollbar mt-8 flex gap-2 overflow-x-auto pb-1"
        >
          {categories.map((cat) => {
            const active = filter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(cat.id)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-150 ease-smooth ${
                  active
                    ? 'border-acid bg-acid text-ink-950'
                    : 'border-ink-600 text-chalk-muted hover:border-ink-500 hover:text-chalk'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="mt-10 flex items-center justify-center rounded-card border border-dashed border-ink-600 px-6 py-16">
            <Loader2Icon className="h-5 w-5 animate-spin text-chalk-dim" />
          </div>
        ) : error ? (
          <div className="mt-10 rounded-card border border-dashed border-rose/40 px-6 py-16 text-center text-sm text-rose">
            {error}
          </div>
        ) : cards.length === 0 ? (
          <div className="mt-10 rounded-card border border-dashed border-ink-600 px-6 py-16 text-center">
            <p className="text-base font-semibold text-chalk">
              {debouncedQuery || hasActiveFilters ? t('feed.noMatches') : t('feed.nothingYet')}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-chalk-muted">
              {debouncedQuery || hasActiveFilters
                ? t('feed.noMatchesBody')
                : t('feed.nothingYetBody')}
            </p>
          </div>
        ) : (
          <>
            <p className="mt-6 text-xs text-chalk-dim">
              {total} {total === 1 ? t('feed.listing') : t('feed.listings')}
              {debouncedQuery ? ` ${t('feed.for')} "${debouncedQuery}"` : ''}
            </p>
            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map((listing, i) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  featured={filter === 'all' && !debouncedQuery && !hasActiveFilters && i === 0}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
