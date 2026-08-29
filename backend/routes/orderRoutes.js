import { Router } from 'express';
import {
  createOrders,
  getMyOrders,
  getReceivedOrders,
  acceptOrder,
  rejectOrder,
  cancelOrder,
  completeOrder
} from '../controllers/orderController.js';
import { protect, requireVerifiedStudent } from '../middleware/auth.js';

const router = Router();

router.use(protect, requireVerifiedStudent);

router.post('/', createOrders);
router.get('/mine', getMyOrders);
router.get('/received', getReceivedOrders);
router.patch('/:id/accept', acceptOrder);
router.patch('/:id/reject', rejectOrder);
router.patch('/:id/complete', completeOrder);
router.delete('/:id', cancelOrder);

export default router;
