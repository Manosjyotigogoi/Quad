import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    enum: ['textbooks', 'dorm', 'tech', 'rides', 'kitchen', 'free']
  },
  label: { type: String, required: true },
  accent: { type: String, default: 'text-acid' }
});

const Category = mongoose.model('Category', categorySchema);
export default Category;
