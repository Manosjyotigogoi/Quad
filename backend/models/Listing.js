import mongoose from 'mongoose';

const listingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 2000 },
    price: { type: Number, required: true, min: 0 },
    wasPrice: { type: Number, default: null },
    condition: {
      type: String,
      enum: ['New', 'Like new', 'Good', 'Fair'],
      required: true
    },
    category: {
      type: String,
      enum: ['textbooks', 'dorm', 'tech', 'rides', 'kitchen', 'free'],
      required: true
    },
    images: [{ url: String, publicId: String }],

    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    pickupSpot: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0, default: 1 },
    status: {
      type: String,
      enum: ['active', 'sold', 'removed'],
      default: 'active'
    },

    // QD-025 — Denormalized seller verification status. Synced via a
    // User post-save hook (see models/User.js). Lets us replace the
    // N+1 "$in approved user IDs" pattern with a direct indexed query.
    verificationStatus: {
      type: String,
      enum: ['not_submitted', 'pending', 'approved', 'rejected'],
      default: 'not_submitted',
      index: true
    },

    savedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  { timestamps: true }
);

// Text search index — $text query uses this.
listingSchema.index({ title: 'text', description: 'text' });
// Compound index for filtered browsing (category + status + newest first).
listingSchema.index({ category: 1, status: 1, createdAt: -1 });
// Index for price-range filtering.
listingSchema.index({ price: 1, status: 1 });
// Index for condition filtering.
listingSchema.index({ condition: 1, status: 1 });
// QD-025 — Compound index for the verifiedOnly filter path.
listingSchema.index({ status: 1, verificationStatus: 1, category: 1, price: 1 });

listingSchema.virtual('watchers').get(function watchers() {
  return this.savedBy?.length ?? 0;
});
listingSchema.set('toJSON', { virtuals: true });

const Listing = mongoose.model('Listing', listingSchema);
export default Listing;
