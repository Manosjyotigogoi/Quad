import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckIcon,
  ImagePlusIcon,
  Loader2Icon,
  XIcon
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const conditions = ['New', 'Like new', 'Good', 'Fair'];
const MAX_IMAGES = 6;

export function NewListing({ editMode = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [wasPrice, setWasPrice] = useState('');
  const [condition, setCondition] = useState(conditions[0]);
  const [category, setCategory] = useState('textbooks');
  const [pickupSpot, setPickupSpot] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [images, setImages] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [loadingListing, setLoadingListing] = useState(editMode);

  // Fetch categories from the API.
  useEffect(() => {
    api.getCategories()
      .then((data) => {
        if (data.categories?.length) {
          setCategory(data.categories[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // In edit mode, pre-fill the form from the existing listing.
  useEffect(() => {
    if (!editMode || !id) return;
    let cancelled = false;
    api.getListing(id)
      .then((data) => {
        if (cancelled) return;
        const l = data.listing;
        setTitle(l.title || '');
        setDescription(l.description || '');
        setPrice(String(l.price ?? ''));
        setWasPrice(l.wasPrice ? String(l.wasPrice) : '');
        setCondition(l.condition || conditions[0]);
        setCategory(l.category || 'textbooks');
        setPickupSpot(l.pickupSpot || '');
        setQuantity(String(l.quantity ?? '1'));
        setExistingImages(l.images || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingListing(false);
      });
    return () => { cancelled = true; };
  }, [editMode, id]);

  const isVerified = user?.verificationStatus === 'approved';

  const handleFiles = (event) => {
    const files = Array.from(event.target.files || []).slice(0, MAX_IMAGES - images.length - existingImages.length);
    setImages((prev) => [...prev, ...files].slice(0, MAX_IMAGES));
    event.target.value = '';
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (index) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (!title.trim() || title.trim().length < 3) {
      setError('Give your item a short, descriptive title.');
      return;
    }
    if (price === '' || Number(price) < 0) {
      setError('Enter a price of $0 or more.');
      return;
    }
    if (!pickupSpot.trim()) {
      setError('Add a pickup spot buyers can meet you at.');
      return;
    }
    if (quantity === '' || Number(quantity) < 1) {
      setError('Enter how many you have to sell — at least 1.');
      return;
    }

    setStatus('loading');
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('price', price);
      if (wasPrice !== '') formData.append('wasPrice', wasPrice);
      formData.append('condition', condition);
      formData.append('category', category);
      formData.append('pickupSpot', pickupSpot.trim());
      formData.append('quantity', quantity);
      images.forEach((file) => formData.append('images', file));

      if (editMode && id) {
        await api.updateListing(id, formData);
        toast.success('Listing updated');
        setTimeout(() => navigate(`/listings/${id}`), 500);
      } else {
        await api.createListing(formData);
        toast.success('Listing posted');
        setTimeout(() => navigate('/profile'), 500);
      }
    } catch (err) {
      setStatus('idle');
      setError(err.message);
      toast.error(err.message);
    }
  };

  if (loadingListing) {
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

  return (
    <div className="flex min-h-screen w-full flex-col bg-ink-950">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12 lg:px-8 lg:py-16">
        <Link
          to={editMode && id ? `/listings/${id}` : '/profile'}
          className="inline-flex items-center gap-1.5 text-sm text-chalk-muted transition-colors hover:text-chalk"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {editMode ? 'Back to listing' : 'Back to profile'}
        </Link>

        <h1 className="mt-6 text-3xl font-extrabold tracking-[-0.02em] text-chalk sm:text-4xl">
          {editMode ? 'Edit your listing' : 'Post an item'}
        </h1>
        <p className="mt-3 text-[15px] text-chalk-muted">
          {editMode ? 'Update the details below.' : 'One clear photo and an honest price get picked up fastest.'}
        </p>

        {!isVerified && !editMode && (
          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-ink-700 bg-ink-850 p-5">
            <AlertCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-tangerine" />
            <div>
              <p className="text-sm font-semibold text-chalk">
                {user?.verificationStatus === 'pending'
                  ? 'Your student ID is under review'
                  : user?.verificationStatus === 'rejected'
                  ? 'Your verification was rejected'
                  : 'Verify your student ID before posting'}
              </p>
              <p className="mt-1 text-sm text-chalk-muted">
                Quad only allows verified students to post.{' '}
                <Link to="/verify" className="font-medium text-acid underline decoration-acid/40 underline-offset-4">
                  Verify your student ID
                </Link>{' '}
                — you can still fill this out, but submitting will be blocked until an admin approves it.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-9 space-y-5" noValidate>
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-chalk">
              Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Organic Chemistry 8th ed. + solutions manual"
              className="mt-2 w-full rounded-xl border border-ink-600 bg-ink-850 px-4 py-3 text-[15px] text-chalk placeholder:text-chalk-dim transition-colors hover:border-ink-500 focus:border-acid focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-chalk">
              Description
            </label>
            <textarea
              id="description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Condition, why you're selling, anything a buyer should know…"
              className="mt-2 w-full resize-none rounded-xl border border-ink-600 bg-ink-850 px-4 py-3 text-[15px] text-chalk placeholder:text-chalk-dim transition-colors hover:border-ink-500 focus:border-acid focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="price" className="block text-sm font-medium text-chalk">
                Price ($)
              </label>
              <input
                id="price"
                type="number"
                min="0"
                step="1"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="45"
                className="mt-2 w-full rounded-xl border border-ink-600 bg-ink-850 px-4 py-3 text-[15px] text-chalk placeholder:text-chalk-dim transition-colors hover:border-ink-500 focus:border-acid focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="wasPrice" className="block text-sm font-medium text-chalk">
                Retail price (optional)
              </label>
              <input
                id="wasPrice"
                type="number"
                min="0"
                step="1"
                value={wasPrice}
                onChange={(e) => setWasPrice(e.target.value)}
                placeholder="210"
                className="mt-2 w-full rounded-xl border border-ink-600 bg-ink-850 px-4 py-3 text-[15px] text-chalk placeholder:text-chalk-dim transition-colors hover:border-ink-500 focus:border-acid focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="condition" className="block text-sm font-medium text-chalk">
                Condition
              </label>
              <select
                id="condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                aria-label="Condition"
                className="mt-2 w-full rounded-xl border border-ink-600 bg-ink-850 px-4 py-3 text-[15px] text-chalk transition-colors hover:border-ink-500 focus:border-acid focus:outline-none"
              >
                {conditions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-chalk">
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label="Category"
                className="mt-2 w-full rounded-xl border border-ink-600 bg-ink-850 px-4 py-3 text-[15px] text-chalk transition-colors hover:border-ink-500 focus:border-acid focus:outline-none"
              >
                <option value="textbooks">Textbooks</option>
                <option value="dorm">Dorm & furniture</option>
                <option value="tech">Tech</option>
                <option value="kitchen">Kitchen</option>
                <option value="rides">Rides & bikes</option>
                <option value="free">Free stuff</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="pickupSpot" className="block text-sm font-medium text-chalk">
                Pickup spot
              </label>
              <input
                id="pickupSpot"
                type="text"
                value={pickupSpot}
                onChange={(e) => setPickupSpot(e.target.value)}
                placeholder="Science Library"
                className="mt-2 w-full rounded-xl border border-ink-600 bg-ink-850 px-4 py-3 text-[15px] text-chalk placeholder:text-chalk-dim transition-colors hover:border-ink-500 focus:border-acid focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="quantity" className="block text-sm font-medium text-chalk">
                Quantity you have
              </label>
              <input
                id="quantity"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1"
                className="mt-2 w-full rounded-xl border border-ink-600 bg-ink-850 px-4 py-3 text-[15px] text-chalk placeholder:text-chalk-dim transition-colors hover:border-ink-500 focus:border-acid focus:outline-none"
              />
            </div>
          </div>

          <div>
            <p className="block text-sm font-medium text-chalk">
              Photos ({images.length + existingImages.length}/{MAX_IMAGES})
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              {/* Existing images (edit mode) */}
              {existingImages.map((img, i) => (
                <div key={`ex-${i}`} className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-ink-600">
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeExistingImage(i)}
                    aria-label="Remove photo"
                    className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink-950/80 text-chalk"
                  >
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {/* New images (previews) */}
              {images.map((file, i) => {
                const url = URL.createObjectURL(file);
                return (
                  <div key={`new-${i}`} className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-ink-600">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      aria-label="Remove photo"
                      className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink-950/80 text-chalk"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
              {images.length + existingImages.length < MAX_IMAGES && (
                <label
                  className="flex h-20 w-20 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-ink-600 text-chalk-dim transition-colors hover:border-ink-500 hover:text-chalk-muted"
                  aria-describedby="upload-help"
                >
                  <ImagePlusIcon className="h-5 w-5" aria-hidden="true" />
                  <span className="text-[11px]">Add</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFiles}
                    aria-label="Upload listing photos"
                    aria-describedby="upload-help"
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          <p id="upload-help" className="sr-only">
            Click to upload up to {MAX_IMAGES} photos of your listing. Photos are stored in Cloudinary.
          </p>

          {error && (
            <motion.p
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 rounded-xl bg-rose/10 px-3.5 py-3 text-sm text-rose"
            >
              <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={status !== 'idle' || (!isVerified && !editMode)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-acid px-6 py-3.5 text-[15px] font-semibold text-ink-950 transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {status === 'loading' && <Loader2Icon className="h-4 w-4 animate-spin" />}
            {status === 'done' && <CheckIcon className="h-4 w-4" />}
            {status === 'idle'
              ? editMode
                ? 'Save changes'
                : isVerified
                ? 'Post item'
                : 'Verification required'
              : status === 'loading'
              ? editMode
                ? 'Saving…'
                : 'Posting…'
              : editMode
              ? 'Saved — opening your listing'
              : 'Posted — opening your profile'}
          </button>
        </form>
      </main>
      <Footer />
    </div>
  );
}
