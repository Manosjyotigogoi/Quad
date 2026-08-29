import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CalendarIcon,
  CheckCircle2Icon,
  HeartIcon,
  Loader2Icon,
  MapPinIcon,
  MessageCircleIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  StarIcon,
  TagIcon
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { api } from '../utils/api';
import { formatPrice, formatRating, getInitials, formatRelativeTime } from '../utils/format';

export function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart, isInCart } = useCart();

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeImage, setActiveImage] = useState(0);
  const [saved, setSaved] = useState(false);
  const [cartBusy, setCartBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.getListing(id)
      .then((data) => {
        if (cancelled) return;
        setListing(data.listing);
        setSaved(data.listing.savedBy?.some((uid) => String(uid) === String(user?.id)));
        // QD-022 — Per-listing dynamic SEO meta tags.
        const l = data.listing;
        document.title = `${l.title} — Quad`;
        const setMeta = (name, content, attr = 'name') => {
          // FIX (QD-022 caught in audit) — set even when content is empty
          // so the previous listing's meta doesn't leak. Caller passes
          // a fallback (e.g. '/pwa-512.png') for missing images.
          let el = document.head.querySelector(`meta[${attr}="${name}"]`);
          if (!el) {
            el = document.createElement('meta');
            el.setAttribute(attr, name);
            document.head.appendChild(el);
          }
          el.setAttribute('content', String(content ?? ''));
        };
        setMeta('description', `${l.title} — ${l.condition}, $${l.price}. ${l.description?.slice(0, 140) || ''}`);
        setMeta('og:title', `${l.title} — Quad`, 'property');
        setMeta('og:description', `${l.condition}, $${l.price}`, 'property');
        // FIX (QD-022 caught in audit) — provide fallback so the meta
        // doesn't leak the previous listing's image when navigating
        // between two detail pages where the second has no images.
        setMeta('og:image', l.images?.[0]?.url || '/pwa-512.png', 'property');
        setMeta('og:url', `${window.location.href}`, 'property');
        setMeta('og:type', 'product', 'property');
        setMeta('twitter:card', 'summary_large_image');
        setMeta('twitter:title', `${l.title} — Quad`);
        setMeta('twitter:description', `${l.condition}, $${l.price}`);
        setMeta('twitter:image', l.images?.[0]?.url || '/pwa-512.png');
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    // FIX (QD-022 caught in audit) — restore the default title on unmount
    // so the listing title doesn't persist when navigating to a
    // non-listing page (e.g. /cart, /orders).
    return () => {
      cancelled = true;
      document.title = 'Quad — Campus Marketplace';
    };
  }, [id, user]);

  const handleSave = async () => {
    if (!user) {
      navigate('/signin');
      return;
    }
    try {
      await api.toggleSaveListing(id);
      setSaved((v) => !v);
      toast.success(saved ? 'Removed from saved' : 'Saved to your list');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleAddToCart = async () => {
    if (!user) {
      navigate('/signin');
      return;
    }
    if (isInCart(listing._id)) {
      navigate('/cart');
      return;
    }
    setCartBusy(true);
    try {
      await addToCart(listing._id);
      toast.success('Added to cart');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCartBusy(false);
    }
  };

  const handleMessage = () => {
    if (!user) {
      navigate('/signin');
      return;
    }
    navigate(`/messages?sellerId=${listing.seller._id}&listingId=${listing._id}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-ink-950">
        <Navbar />
        <div className="flex flex-1 items-center justify-center">
          <Loader2Icon className="h-6 w-6 animate-spin text-chalk-dim" />
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-ink-950">
        <Navbar />
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-5 py-16 text-center">
          <AlertCircleIcon className="h-10 w-10 text-rose" />
          <p className="mt-4 text-base font-semibold text-chalk">{error || 'Listing not found'}</p>
          <Link
            to="/#feed"
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-acid px-4 py-2 text-sm font-semibold text-ink-950 transition-transform hover:scale-[1.03]"
          >
            Back to the board
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const images = listing.images?.length > 0 ? listing.images : [{ url: '/vite.svg' }];
  const seller = listing.seller || {};
  const isOwnListing = String(seller._id) === String(user?.id);
  const outOfStock = listing.status !== 'active' || listing.quantity <= 0;
  const inCart = isInCart(listing._id);

  return (
    <div className="flex min-h-screen w-full flex-col bg-ink-950">
      <Navbar />
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-5 py-8 lg:px-8 lg:py-12">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-chalk-muted transition-colors hover:text-chalk"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </button>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
          {/* Image gallery */}
          <div>
            <div className="overflow-hidden rounded-card border border-ink-700 bg-ink-900">
              <img
                src={images[activeImage]?.url}
                alt={listing.title}
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
                {images.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                      i === activeImage ? 'border-acid' : 'border-ink-700 hover:border-ink-500'
                    }`}
                  >
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-3xl font-extrabold tracking-tight text-acid">
                {formatPrice(listing.price)}
              </p>
              {listing.wasPrice && (
                <p className="text-sm text-chalk-dim line-through">
                  ${listing.wasPrice} retail
                </p>
              )}
            </div>

            <h1 className="mt-2 text-2xl font-bold leading-snug text-chalk sm:text-3xl">
              {listing.title}
            </h1>

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-chalk-muted">
              <span className="flex items-center gap-1.5">
                <TagIcon className="h-4 w-4" />
                {listing.condition}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPinIcon className="h-4 w-4" />
                {listing.pickupSpot}
              </span>
              {listing.quantity > 1 && !outOfStock && (
                <span className="flex items-center gap-1.5">
                  <CheckCircle2Icon className="h-4 w-4" />
                  {listing.quantity} in stock
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <CalendarIcon className="h-4 w-4" />
                Posted {formatRelativeTime(listing.createdAt)}
              </span>
            </div>

            {/* Seller card */}
            <Link
              to={seller._id ? `/sellers/${seller._id}` : '#'}
              className="mt-6 flex items-center gap-3 rounded-card border border-ink-700 bg-ink-850 p-4 transition-colors hover:border-ink-500"
            >
              <Avatar initials={getInitials(seller.name)} size="md" accent="acid" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-chalk">
                  <span className="truncate">{seller.name}</span>
                  {seller.verification?.status === 'approved' && (
                    <ShieldCheckIcon className="h-3.5 w-3.5 shrink-0 text-sky" aria-label="Verified student" />
                  )}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-chalk-muted">
                  <StarIcon className="h-3 w-3 fill-acid text-acid" />
                  {formatRating(seller.rating)} · {seller.reviewCount || 0} reviews · {seller.itemsSold || 0} sold
                </p>
              </div>
              <span className="text-xs text-chalk-dim">View →</span>
            </Link>

            {/* Description */}
            {listing.description && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-chalk">Description</h2>
                <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-chalk-muted">
                  {listing.description}
                </p>
              </div>
            )}

            {/* Actions */}
            {!isOwnListing && (
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {outOfStock ? (
                  <button
                    type="button"
                    disabled
                    className="flex-1 cursor-not-allowed rounded-full bg-ink-700 px-6 py-3 text-center text-sm font-semibold text-chalk-dim"
                  >
                    Out of stock
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleAddToCart}
                      disabled={cartBusy}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-ink-600 px-6 py-3 text-sm font-semibold text-chalk transition-colors hover:border-ink-500 disabled:opacity-70"
                    >
                      {cartBusy ? (
                        <Loader2Icon className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShoppingCartIcon className="h-4 w-4" />
                      )}
                      {inCart ? 'In cart — view' : 'Add to cart'}
                    </button>
                    <button
                      type="button"
                      onClick={handleMessage}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-acid px-6 py-3 text-sm font-bold text-ink-950 transition-transform hover:scale-[1.02]"
                    >
                      <MessageCircleIcon className="h-4 w-4" />
                      Message seller
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  aria-pressed={saved}
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-ink-600 text-chalk-muted transition-colors hover:border-ink-500 hover:text-chalk"
                >
                  <HeartIcon className={`h-5 w-5 ${saved ? 'fill-rose text-rose' : ''}`} />
                </button>
              </div>
            )}

            {isOwnListing && (
              <div className="mt-8 flex gap-3">
                <Link
                  to={`/listings/${listing._id}/edit`}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-ink-600 px-6 py-3 text-sm font-semibold text-chalk transition-colors hover:border-ink-500"
                >
                  Edit listing
                </Link>
                {listing.status === 'active' && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm('Mark this listing as sold?')) return;
                      try {
                        await api.markListingSold(listing._id);
                        toast.success('Listing marked as sold');
                        navigate('/profile');
                      } catch (err) {
                        toast.error(err.message);
                      }
                    }}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-acid px-6 py-3 text-sm font-bold text-ink-950 transition-transform hover:scale-[1.02]"
                  >
                    Mark as sold
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
