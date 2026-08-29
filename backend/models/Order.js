import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    items: [
      {
        listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
        title: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true, min: 1 }
      }
    ],

    deliveryLocation: { type: String, required: true, trim: true },
    deliveryTime: { type: Date, required: true },

    status: {
      type: String,
      // 'completed' = the buyer confirmed they received the item, which
      // unlocks the ability to leave a review.
      enum: ['pending', 'accepted', 'rejected', 'cancelled', 'completed'],
      default: 'pending'
    },
    respondedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    // QD-006 fix — list of listing IDs whose stock hit 0 at accept time
    // (and therefore bumped the seller's itemsSold counter). Used by
    // cancelOrder to conditionally decrement itemsSold ONLY for these
    // items, so cancelling an order for a partial-stock listing doesn't
    // corrupt the seller's stat counter.
    itemsSoldBumps: { type: [String], default: [] }
  },
  { timestamps: true }
);

orderSchema.virtual('total').get(function total() {
  return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
});
orderSchema.set('toJSON', { virtuals: true });

const Order = mongoose.model('Order', orderSchema);
export default Order;
