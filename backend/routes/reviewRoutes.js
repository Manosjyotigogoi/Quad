import { Router } from 'express';
import { createReview, getSellerReviews } from '../controllers/reviewController.js';
import { protect, requireVerifiedStudent } from '../middleware/auth.js';

const router = Router();

router.post('/', protect, requireVerifiedStudent, createReview);
router.get('/seller/:sellerId', getSellerReviews);

export default router;
