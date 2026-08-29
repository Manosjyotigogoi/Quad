import { Router } from 'express';
import {
  getMyConversations,
  startConversation,
  getMessages,
  sendMessage,
  markRead
} from '../controllers/messageController.js';
import { protect, requireVerifiedStudent } from '../middleware/auth.js';
import { messageRateLimiter, conversationStartLimiter } from '../middleware/messageRateLimiter.js';

const router = Router();

router.use(protect, requireVerifiedStudent);

router.get('/conversations', getMyConversations);
// QD-resource-limit — per-user cap on new conversations per hour.
router.post('/conversations', conversationStartLimiter, startConversation);
router.get('/conversations/:id', getMessages);
// QD-resource-limit — per-(user, conversation) message rate cap.
router.post('/conversations/:id', messageRateLimiter, sendMessage);
router.patch('/conversations/:id/read', markRead);

export default router;
