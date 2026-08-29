import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  CheckIcon,
  ClockIcon,
  Loader2Icon,
  MapPinIcon,
  PencilIcon,
  StarIcon,
  XIcon } from
'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Avatar } from '../components/Avatar';
import { ListingCard } from '../components/ListingCard';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { formatRating, getInitials, formatRelativeTime } from '../utils/format';

// The backend stores listings as { images: [{url}], seller: id, pickupSpot, ... }
// — this reshapes one into what <ListingCard> expects, using the current
// user for the seller fields since every listing on this page is theirs.
function toCardListing(listing, user) {
  return {
    id: listing._id,
    title: listing.title,
    price: listing.price,
    wasPrice: listing.wasPrice || undefined,
    condition: listing.condition,
    category: listing.category,
    image: listing.images?.[0]?.url || '/vite.svg',
    seller: {
      id: user.id,
      name: user.name,
      initials: getInitials(user.name),
      campus: user.dorm || '',
      rating: user.rating,
      verified: user.verificationStatus === 'approved'
    },
    postedAgo: formatRelativeTime(listing.createdAt),
    pickup: listing.pickupSpot,
    stock: listing.quantity ?? 1,
    watchers: listing.watchers ?? listing.savedBy?.length ?? 0
  };
}

export function Profile() {
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState('listings');

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', major: '', dorm: '', bio: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [editError, setEditError] = useState(null);

  const [listings, setListings] = useState([]);
  const [sold, setSold] = useState([]);
  const [saved, setSaved] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    Promise.all([
    api.getMyListings(),
    api.getMySoldListings(),
    api.getMySavedListings(),
    api.getUserReviews(user.id)]
    ).
    then(([listingsRes, soldRes, savedRes, reviewsRes]) => {
      if (cancelled) return;
      setListings(listingsRes.listings.map((l) => toCardListing(l, user)));
      setSold(soldRes.listings.map((l) => toCardListing(l, user)));
      setSaved(savedRes.listings.map((l) => toCardListing(l, user)));
      setReviews(reviewsRes.reviews);
    }).
    catch((err) => {
      if (!cancelled) setError(err.message);
    }).
    finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;

  const tabs = [
  { id: 'listings', label: 'Listings', count: listings.length },
  { id: 'sold', label: 'Sold', count: sold.length },
  { id: 'saved', label: 'Saved', count: saved.length },
  { id: 'reviews', label: 'Reviews', count: reviews.length }];


  const grid =
  tab === 'listings' ?
  listings :
  tab === 'sold' ?
  sold :
  tab === 'saved' ?
  saved :
  [];

  const isVerified = user.verificationStatus === 'approved';

  const startEditing = () => {
    setEditForm({
      name: user.name || '',
      major: user.major || '',
      dorm: user.dorm || '',
      bio: user.bio || ''
    });
    setEditError(null);
    setEditing(true);
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    setEditError(null);

    if (editForm.name.trim().length < 2) {
      setEditError('Add the name your classmates will see.');
      return;
    }

    setSavingProfile(true);
    try {
      await api.updateMyProfile({
        name: editForm.name.trim(),
        major: editForm.major.trim(),
        dorm: editForm.dorm.trim(),
        bio: editForm.bio.trim()
      });
      await refreshUser();
      setEditing(false);
      toast.success('Profile updated');
    } catch (err) {
      setEditError(err.message);
      toast.error(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-ink-950">
      <Navbar />

      <main className="mx-auto w-full max-w-[1240px] px-5 py-12 lg:px-8 lg:py-16">
        <header className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <Avatar initials={getInitials(user.name)} size="lg" accent="acid" />
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-extrabold tracking-[-0.02em] text-chalk sm:text-4xl">
                  {user.name}
                </h1>
                {isVerified &&
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sky/12 px-2.5 py-1 text-xs font-semibold text-sky">
                    <CheckCircle2Icon className="h-3.5 w-3.5" />
                    .edu verified
                  </span>
                }
              </div>
              <p className="mt-2 text-[15px] text-chalk-muted">
                {user.email}
                {user.major ? ` · ${user.major}` : ''}
              </p>
              {user.bio &&
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-chalk-muted">
                  {user.bio}
                </p>
              }

              <dl className="mt-6 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <StarIcon className="h-4 w-4 fill-acid text-acid" />
                  <dt className="sr-only">Seller rating</dt>
                  <dd className="font-semibold text-chalk">
                    {formatRating(user.rating)}
                    <span className="ml-1 font-normal text-chalk-dim">
                      ({user.reviewCount || 0})
                    </span>
                  </dd>
                </div>
                {user.dorm &&
                <div className="flex items-center gap-1.5 text-chalk-muted">
                    <MapPinIcon className="h-4 w-4" />
                    <dt className="sr-only">Pickup area</dt>
                    <dd>{user.dorm}</dd>
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
                      {user.itemsSold || 0}
                    </span>{' '}
                    items sold
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="flex shrink-0 gap-2.5">
            <button
              type="button"
              onClick={editing ? () => setEditing(false) : startEditing}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink-600 px-5 py-2.5 text-sm font-medium text-chalk-muted transition-colors duration-150 ease-smooth hover:border-ink-500 hover:text-chalk">
              
              {editing ? <XIcon className="h-4 w-4" /> : <PencilIcon className="h-4 w-4" />}
              {editing ? 'Cancel' : 'Edit profile'}
            </button>
          </div>
        </header>

        {editing &&
        <form
          onSubmit={handleSaveProfile}
          className="mt-8 grid gap-4 rounded-2xl border border-ink-700 bg-ink-850 p-5 sm:grid-cols-2">
          
            <div>
              <label htmlFor="edit-name" className="block text-sm font-medium text-chalk">
                Full name
              </label>
              <input
                id="edit-name"
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-2 w-full rounded-xl border border-ink-600 bg-ink-900 px-3.5 py-2.5 text-sm text-chalk focus:border-acid focus:outline-none" />
              
            </div>
            <div>
              <label htmlFor="edit-major" className="block text-sm font-medium text-chalk">
                Major
              </label>
              <input
                id="edit-major"
                type="text"
                value={editForm.major}
                onChange={(e) => setEditForm((f) => ({ ...f, major: e.target.value }))}
                placeholder="Computer Science"
                className="mt-2 w-full rounded-xl border border-ink-600 bg-ink-900 px-3.5 py-2.5 text-sm text-chalk placeholder:text-chalk-dim focus:border-acid focus:outline-none" />
              
            </div>
            <div>
              <label htmlFor="edit-dorm" className="block text-sm font-medium text-chalk">
                Dorm / pickup area
              </label>
              <input
                id="edit-dorm"
                type="text"
                value={editForm.dorm}
                onChange={(e) => setEditForm((f) => ({ ...f, dorm: e.target.value }))}
                placeholder="North Quad"
                className="mt-2 w-full rounded-xl border border-ink-600 bg-ink-900 px-3.5 py-2.5 text-sm text-chalk placeholder:text-chalk-dim focus:border-acid focus:outline-none" />
              
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="edit-bio" className="block text-sm font-medium text-chalk">
                Bio
              </label>
              <textarea
                id="edit-bio"
                rows={3}
                value={editForm.bio}
                onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
                placeholder="Tell buyers a bit about yourself"
                className="mt-2 w-full resize-none rounded-xl border border-ink-600 bg-ink-900 px-3.5 py-2.5 text-sm text-chalk placeholder:text-chalk-dim focus:border-acid focus:outline-none" />
              
            </div>

            {editError &&
          <p className="sm:col-span-2 flex items-center gap-2 rounded-xl bg-rose/10 px-3.5 py-3 text-sm text-rose">
                <AlertCircleIcon className="h-4 w-4 shrink-0" />
                {editError}
              </p>
          }

            <div className="sm:col-span-2 flex gap-2.5">
              <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center gap-1.5 rounded-full bg-acid px-5 py-2.5 text-sm font-semibold text-ink-950 transition-transform duration-150 ease-smooth hover:scale-[1.02] disabled:opacity-60">
              
                {savingProfile ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <CheckIcon className="h-4 w-4" />}
                Save changes
              </button>
            </div>
          </form>
        }

        {!isVerified &&
        <div className="mt-8 flex items-start gap-3 rounded-2xl border border-ink-700 bg-ink-850 p-5">
            <AlertCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-tangerine" />
            <div>
              <p className="text-sm font-semibold text-chalk">
                {user.verificationStatus === 'pending' ?
              'Your student ID is under review' :
              user.verificationStatus === 'rejected' ?
              'Your verification was rejected' :
              'Verify your student ID to start posting'}
              </p>
              <p className="mt-1 text-sm text-chalk-muted">
                Quad requires a reviewed student ID before you can post a listing
                or message other students.
                {user.verificationStatus === 'not_submitted' &&
                <>
                    {' '}
                    <Link to="/verify" className="font-medium text-acid underline decoration-acid/40 underline-offset-4">
                      Upload your ID
                    </Link>{' '}
                    to get started.
                  </>
                }
                {user.verificationStatus === 'rejected' &&
                <>
                    {' '}
                    <Link to="/verify" className="font-medium text-acid underline decoration-acid/40 underline-offset-4">
                      Resubmit it
                    </Link>{' '}
                    to try again.
                  </>
                }
              </p>
            </div>
          </div>
        }

        {error &&
        <div className="mt-8 flex items-start gap-2 rounded-xl bg-rose/10 px-4 py-3 text-sm text-rose">
            <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        }

        <div className="mt-12 border-b border-ink-700/70">
          <div
            role="tablist"
            aria-label="Profile sections"
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

        {loading ?
        <div className="mt-10 rounded-card border border-dashed border-ink-600 px-6 py-16 text-center">
            <p className="text-sm text-chalk-muted">Loading…</p>
          </div> :
        tab === 'reviews' ?
        reviews.length === 0 ?
        <div className="mt-10 rounded-card border border-dashed border-ink-600 px-6 py-16 text-center">
            <p className="text-base font-semibold text-chalk">No reviews yet</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-chalk-muted">
              Reviews from buyers will show up here after your first sale.
            </p>
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
            <p className="text-base font-semibold text-chalk">
              Nothing here yet
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-chalk-muted">
              {tab === 'listings' ?
            <>
                  Items you post will show up in this tab.{' '}
                  <Link to="/listings/new" className="font-medium text-acid underline decoration-acid/40 underline-offset-4">
                    Post your first item
                  </Link>
                </> :

            'Items you sell or save will show up in this tab.'}
            </p>
          </div> :

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {grid.map((listing) => (
          <div key={listing.id} className="flex flex-col gap-2">
            <ListingCard listing={listing} />
            {tab === 'listings' && (
              <div className="flex gap-2 px-1">
                <Link
                  to={`/listings/${listing.id}/edit`}
                  className="flex-1 rounded-full border border-ink-600 px-3 py-1.5 text-center text-xs font-medium text-chalk-muted transition-colors hover:border-ink-500 hover:text-chalk"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm('Mark this listing as sold?')) return;
                    try {
                      await api.markListingSold(listing.id);
                      setListings((prev) => prev.filter((l) => l.id !== listing.id));
                      setSold((prev) => [listing, ...prev]);
                      await refreshUser();
                    } catch (err) {
                      // handled below
                    }
                  }}
                  className="flex-1 rounded-full border border-ink-600 px-3 py-1.5 text-center text-xs font-medium text-chalk-muted transition-colors hover:border-acid hover:text-acid"
                >
                  Mark sold
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm('Delete this listing? This cannot be undone.')) return;
                    try {
                      await api.deleteListing(listing.id);
                      setListings((prev) => prev.filter((l) => l.id !== listing.id));
                    } catch (err) {
                      // silent
                    }
                  }}
                  className="flex-1 rounded-full border border-ink-600 px-3 py-1.5 text-center text-xs font-medium text-chalk-muted transition-colors hover:border-rose hover:text-rose"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
            ))}
          </div>
        }
      </main>

      <Footer />
    </div>);

}