import Category from '../models/Category.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// GET /api/categories
export const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find().sort({ label: 1 });
  res.json({ categories });
});
