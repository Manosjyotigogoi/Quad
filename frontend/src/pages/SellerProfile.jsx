import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  ClockIcon,
  Loader2Icon,
  MapPinIcon,
  MessageCircleIcon,
  ShieldAlertIcon,
  StarIcon } from
'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Avatar } from '../components/Avatar';
import { ListingCard } from '../components/ListingCard';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { formatRating, getInitials, formatRelativeTime } from '../utils/format';

// The backend stores a listing as { images: [{url}], seller, pickupSpot,
// savedBy, quantity, ... } — this reshapes one into what <ListingCard>
// expects, using the profile's own user record for the seller fields
// since every listing here belongs to them. Mirrors Profile.jsx's own
// toCardListing so a seller's public page looks/behaves the same as
// their own profile view.
function toCardListing(listing, profileUser) {
  return {
    id: listing._id,
    title: listing.title,
    price: listing.price,
    wasPrice: listing.wasPrice || undefined,
    condition: listing.condition,
    category: listing.category,
    image: listing.images?.[0]?.url || '/vite.svg',
    seller: {
      id: profileUser.id,
      name: profileUser.name,
      verified: profileUser.verified
    },
    postedAgo: formatRelativeTime(listing.createdAt),
    pickup: listing.pickupSpot,
    stock: listing.quantity ?? 1,
    watchers: listing.watchers ?? listing.savedBy?.length ?? 0
  };
}

export function SellerProfile() {
  const { id } = useParams();
  const { user: viewer } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [sold, setSold] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [tab, setTab] = useState('listings');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isViewerVerified = viewer?.verificationStatus === 'approved';

  useEffect(() => {
    if (!isViewerVerified) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTab('listings');

    api
      .getUserProfile(id)
      .then((data) => {
        if (cancelled) return;
        setProfile(data.user);
        setListings(data.listings.map((l) => toCardListing(l, data.user)));
        setSold((data.soldListings || []).map((l) => toCardListing(l, data.user)));
        setReviews(data.reviews);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, isViewerVerified]);

  const isOwnProfile = viewer?.id === id;
  const canMessage = Boolean(profile) && !isOwnProfile;

  const tabs = profile ?
  [
  { id: 'listings', label: 'Listings', count: listings.length },
  { id: 'sold', label: 'Sold', count: sold.length },
  { id: 'reviews', label: 'Reviews', count: reviews.length }] :

  [];

  const grid = tab === 'listings' ? listings : tab === 'sold' ? sold : [];

  return (
    <div className="min-h-screen w-full bg-ink-950">
      <Navbar />

      <main className="mx-auto w-full max-w-[1240px] px-5 py-12 lg:px-8 lg:py-16">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-chalk-muted transition-colors duration-150 ease-smooth hover:text-chalk">
          
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </button>

        {!isViewerVerified ?
        <div className="mt-8 flex items-start gap-3 rounded-2xl border border-ink-700 bg-ink-850 p-5">
            <ShieldAlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-tangerine" />
            <div>
              <p className="text-sm font-semibold text-chalk">
                Verify your student ID to view seller profiles
              </p>
              <p className="mt-1 text-sm text-chalk-muted">
                Quad keeps profiles visible to verified students only, to
                keep the marketplace to real people on campus.
              </p>
              <Link
              to="/verify"
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-acid px-4 py-2 text-sm font-semibold text-ink-950 transition-transform duration-150 ease-smooth hover:scale-[1.03]">
              
                Verify your ID
              </Link>
            </div>
          </div> :
        loading ?
        <div className="mt-10 flex items-center justify-center rounded-card border border-dashed border-ink-600 px-6 py-16">
            <Loader2Icon className="h-5 w-5 animate-spin text-chalk-dim" />
          </div> :
        error ?
        <div className="mt-10 rounded-card border border-dashed border-rose/40 px-6 py-16 text-center text-sm text-rose">
            {error}
          </div> :

        <>
            <header className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                <Avatar initials={getInitials(profile.name)} size="lg" accent="acid" />
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-extrabold tracking-[-0.02em] text-chalk sm:text-4xl">
                      {profile.name}
                    </h1>
                    {profile.verified &&
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-sky/12 px-2.5 py-1 text-xs font-semibold text-sky">
                        <CheckCircle2Icon className="h-3.5 w-3.5" />
                        .edu verified
                      </span>
                  }
                  </div>
                  <p className="mt-2 text-[15px] text-chalk-muted">{profile.major}</p>
                  {profile.bio &&
                <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-chalk-muted">
                      {profile.bio}
                    </p>
                }

                  <dl className="mt-6 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm">
                    <div className="flex items-center gap-1.5">
                      <StarIcon className="h-4 w-4 fill-acid text-acid" />
                      <dt className="sr-only">Seller rating</dt>
                      <dd className="font-semibold text-chalk">
                        {formatRating(profile.rating)}
                        <span className="ml-1 font-normal text-chalk-dim">
                          ({profile.reviewCount || 0})
                        </span>
                      </dd>
                    </div>
                    {profile.dorm &&
                  <div className="flex items-center gap-1.5 text-chalk-muted">
                        <MapPinIcon className="h-4 w-4" />
                        <dt className="sr-only">Pickup area</dt>
                        <dd>{profile.dorm}</dd>
                      </div>
                  }
                    <div className="flex items-center gap-1.5 text-chalk-muted">
                      <ClockIcon className="h-4 w-4" />
                      <dt className="sr-only">Response time</dt>
                      <dd>New here</dd>
                    </div>
                    <div className="text-chalk-muted">
                      <dt className="sr-only">Items sold</dt>
                      <dd>
                        <span className="font-semibold text-chalk">
                          {profile.itemsSold || 0}
                        </span>{' '}
                        items sold
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              {canMessage &&
            <button
              type="button"
              onClick={() => navigate(`/messages?sellerId=${profile.id}`)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-acid px-5 py-2.5 text-sm font-semibold text-ink-950 transition-transform duration-150 ease-smooth hover:scale-[1.03]">
              
                  <MessageCircleIcon className="h-4 w-4" />
                  Message
                </button>
            }
            </header>

            <div className="mt-12 border-b border-ink-700/70">
              <div
              role="tablist"
              aria-label="Seller sections"
              className="no-scrollbar -mb-px flex gap-7 overflow-x-auto">
              
                {tabs.map((t) => {
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
                      <span className="ml-1.5 font-normal text-chalk-dim">
                        {t.count}
                      </span>
                    </button>);

              })}
              </div>
            </div>

            {tab === 'reviews' ?
          reviews.length === 0 ?
          <div className="mt-10 rounded-card border border-dashed border-ink-600 px-6 py-16 text-center">
                <p className="text-base font-semibold text-chalk">No reviews yet</p>
              </div> :

          <ul className="mt-10 max-w-3xl divide-y divide-ink-700/80">
                {reviews.map((review) =>
            <li key={review._id} className="flex gap-4 py-6 first:pt-0">
                    <Avatar initials={getInitials(review.reviewer?.name)} accent="grape" />
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-sm font-semibold text-chalk">
                          {review.reviewer?.name || 'Former buyer'}
                        </p>
                        <p
                  className="flex items-center gap-0.5"
                  aria-label={`${review.rating} out of 5 stars`}>
                  
                          {Array.from({ length: 5 }).map((_, i) =>
                  <StarIcon
                    key={i}
                    className={`h-3.5 w-3.5 ${
                    i < review.rating ?
                    'fill-acid text-acid' :
                    'text-ink-500'}`
                    } />

                  )}
                        </p>
                        <p className="text-xs text-chalk-dim">
                          {formatRelativeTime(review.createdAt)}
                        </p>
                      </div>
                      <p className="mt-2 text-[15px] leading-relaxed text-chalk-muted">
                        {review.body}
                      </p>
                      {review.listing?.title &&
              <p className="mt-2 text-xs text-chalk-dim">
                          Bought: {review.listing.title}
                        </p>
              }
                    </div>
                  </li>
            )}
              </ul> :

          grid.length === 0 ?
          <div className="mt-10 rounded-card border border-dashed border-ink-600 px-6 py-16 text-center">
                <p className="text-base font-semibold text-chalk">Nothing here yet</p>
              </div> :

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {grid.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
              </div>
          }
          </>
        }
      </main>

      <Footer />
    </div>);

}
