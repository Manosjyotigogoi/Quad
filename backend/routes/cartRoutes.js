import { Router } from 'express';
import { getCart, addToCart, updateCartItemQuantity, removeFromCart, clearCart } from '../controllers/cartController.js';
import { protect, requireVerifiedStudent } from '../middleware/auth.js';

const router = Router();

router.use(protect, requireVerifiedStudent);

router.get('/', getCart);
router.post('/:listingId', addToCart);
router.patch('/:listingId', updateCartItemQuantity);
router.delete('/:listingId', removeFromCart);
router.delete('/', clearCart);

export default router;
