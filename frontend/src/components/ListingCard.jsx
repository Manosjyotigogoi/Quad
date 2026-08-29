import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  HeartIcon,
  Loader2Icon,
  MapPinIcon,
  MessageCircleIcon,
  ShoppingCartIcon,
  ShieldCheckIcon
} from 'lucide-react';
import { formatPrice } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { api } from '../utils/api';

export function ListingCard({ listing, featured = false }) {
  const [saved, setSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [cartBusy, setCartBusy] = useState(false);
  const { user } = useAuth();
  const { isInCart, addToCart } = useCart();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const isOwnListing = Boolean(listing.seller?.id) && listing.seller.id === user?.id;
  const stock = listing.stock ?? listing.quantity ?? 1;
  const outOfStock = stock <= 0;
  const canMessageSeller = Boolean(listing.seller?.id) && !isOwnListing;
  const canBuy = Boolean(listing.seller?.id) && !isOwnListing && !outOfStock;
  const inCart = isInCart(listing.id);

  const handleCardClick = () => {
    navigate(`/listings/${listing.id}`);
  };

  const handleMessageSeller = (event) => {
    event.stopPropagation();
    if (!user) {
      navigate('/signin');
      return;
    }
    navigate(`/messages?sellerId=${listing.seller.id}&listingId=${listing.id}`);
  };

  const handleSellerClick = (event) => {
    event.stopPropagation();
    if (listing.seller?.id) navigate(`/sellers/${listing.seller.id}`);
  };

  const handleAddToCart = async (event) => {
    event.stopPropagation();
    if (!user) {
      navigate('/signin');
      return;
    }
    if (inCart || cartBusy) return;
    setCartBusy(true);
    try {
      await addToCart(listing.id);
      toast.success(t('card.addedToCart'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCartBusy(false);
    }
  };

  const handleBuyNow = async (event) => {
    event.stopPropagation();
    if (!user) {
      navigate('/signin');
      return;
    }
    setCartBusy(true);
    try {
      if (!inCart) await addToCart(listing.id);
      navigate('/cart');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCartBusy(false);
    }
  };

  const handleSave = async (event) => {
    event.stopPropagation();
    if (!user) {
      navigate('/signin');
      return;
    }
    if (saveBusy) return;
    setSaveBusy(true);
    try {
      await api.toggleSaveListing(listing.id);
      setSaved((v) => !v);
      toast.success(saved ? t('card.unsavedToast') : t('card.savedToast'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaveBusy(false);
    }
  };

  return (
    <article
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') handleCardClick(); }}
      className={`group flex cursor-pointer flex-col overflow-hidden rounded-card border border-ink-700 bg-ink-850 transition-colors duration-200 ease-smooth hover:border-ink-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-acid ${
        featured ? 'sm:col-span-2 sm:row-span-2' : ''
      }`}
    >
      <div className="relative overflow-hidden bg-ink-900">
        <img
          src={listing.image}
          alt={listing.title}
          className={`w-full object-cover transition-transform duration-300 ease-smooth group-hover:scale-[1.03] ${
            featured ? 'aspect-[4/3] sm:aspect-[16/11]' : 'aspect-[4/3]'
          }`}
          loading="lazy"
        />
        <button
          type="button"
          onClick={handleSave}
          aria-pressed={saved}
          aria-label={saved ? `Unsave ${listing.title}` : `Save ${listing.title}`}
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink-950/70 text-chalk backdrop-blur transition-colors duration-150 ease-smooth hover:bg-ink-950"
        >
          {saveBusy ? (
            <Loader2Icon className="h-4 w-4 animate-spin" />
          ) : (
            <HeartIcon className={`h-4 w-4 ${saved ? 'fill-rose text-rose' : ''}`} />
          )}
        </button>
        {listing.price === 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-acid px-2.5 py-1 text-[11px] font-bold text-ink-950">
            {t('card.free')}
          </span>
        )}
        {outOfStock && (
          <span className="absolute bottom-3 left-3 rounded-full bg-ink-950/85 px-2.5 py-1 text-[11px] font-bold text-rose backdrop-blur">
            {t('card.outOfStock')}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p
            className={`font-extrabold tracking-tight text-acid ${
              featured ? 'text-3xl' : 'text-xl'
            }`}
          >
            {formatPrice(listing.price)}
          </p>
          {listing.wasPrice && (
            <p className="text-xs text-chalk-dim line-through">
              ${listing.wasPrice} {t('card.retail')}
            </p>
          )}
        </div>

        <h3
          className={`mt-1.5 font-semibold leading-snug text-chalk ${
            featured ? 'text-lg' : 'text-[15px]'
          }`}
        >
          {listing.title}
        </h3>

        <p className="mt-2 flex items-center gap-1.5 text-xs text-chalk-muted">
          <MapPinIcon className="h-3.5 w-3.5 shrink-0" />
          {listing.pickup} · {listing.condition}
          {stock > 1 && !outOfStock && ` · ${stock} ${t('card.inStock')}`}
        </p>

        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <button
            type="button"
            onClick={handleSellerClick}
            disabled={!listing.seller?.id}
            className="flex min-w-0 items-center gap-1.5 truncate text-xs text-chalk-muted transition-colors duration-150 ease-smooth hover:text-chalk disabled:cursor-default"
          >
            <span className="truncate font-medium text-chalk">
              {listing.seller.name}
            </span>
            {listing.seller.verified && (
              <ShieldCheckIcon
                className="h-3.5 w-3.5 shrink-0 text-sky"
                aria-label={t('card.verifiedStudent')}
              />
            )}
          </button>
          <div className="flex shrink-0 items-center gap-2">
            {canMessageSeller && (
              <button
                type="button"
                onClick={handleMessageSeller}
                aria-label={t('card.messageSeller', { name: listing.seller.name })}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-chalk-muted transition-colors duration-150 ease-smooth hover:bg-ink-800 hover:text-chalk"
              >
                <MessageCircleIcon className="h-4 w-4" />
              </button>
            )}
            <p className="text-xs text-chalk-dim">{listing.postedAgo}</p>
          </div>
        </div>

        {(canMessageSeller || canBuy) && (
          <div className="mt-3 flex items-center gap-2">
            {outOfStock ? (
              <button
                type="button"
                disabled
                className="flex-1 cursor-not-allowed rounded-full bg-ink-700 px-3 py-2 text-center text-xs font-semibold text-chalk-dim"
              >
                {t('card.outOfStock')}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={inCart || cartBusy}
                  aria-pressed={inCart}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-ink-600 px-3 py-2 text-xs font-semibold text-chalk transition-colors duration-150 ease-smooth hover:border-ink-500 disabled:cursor-default disabled:opacity-70"
                >
                  {cartBusy ? (
                    <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ShoppingCartIcon className="h-3.5 w-3.5" />
                  )}
                  {inCart ? t('card.inCart') : t('card.addCart')}
                </button>
                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={cartBusy}
                  className="flex-1 rounded-full bg-acid px-3 py-2 text-xs font-bold text-ink-950 transition-transform duration-150 ease-smooth hover:scale-[1.02] disabled:opacity-70"
                >
                  {t('card.buyNow')}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
