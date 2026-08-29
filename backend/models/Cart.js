import mongoose from 'mongoose';

const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [
      {
        listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
        quantity: { type: Number, required: true, min: 1, default: 1 },
        addedAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

// QD-010 — Unique index on (user, items.listing) so two concurrent
// add-to-cart calls can't both push a row for the same listing. The
// controller's atomic findOneAndUpdate handles the normal case; this
// index is the defense-in-depth backstop for the race window.
//
// Note: partialFilterExpression is needed because MongoDB's unique
// index treats missing fields as null, which would collide across
// empty carts. We only enforce uniqueness when items.listing is present.
cartSchema.index(
  { user: 1, 'items.listing': 1 },
  {
    unique: true,
    partialFilterExpression: { 'items.listing': { $exists: true, $ne: null } }
  }
);

const Cart = mongoose.model('Cart', cartSchema);
export default Cart;
