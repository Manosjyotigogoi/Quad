import { Router } from 'express';
import {
  getUserProfile,
  searchUsers,
  updateMyProfile,
  updateMyAvatar,
  getMyListings,
  getMySoldListings,
  getMySavedListings,
  submitVerification,
  getMyVerificationStatus,
  getMySavedSearches,
  addSavedSearch,
  removeSavedSearch,
  getMyNotifications,
  markNotificationRead,
  deleteNotification
} from '../controllers/userController.js';
import { protect, requireVerifiedStudent } from '../middleware/auth.js';
import { uploadAvatar, uploadVerificationDocs } from '../middleware/upload.js';

const router = Router();

// Order matters: /me and /search routes must come before the /:id catch-all.
router.put('/me', protect, updateMyProfile);
router.put('/me/avatar', protect, uploadAvatar, updateMyAvatar);
router.get('/me/listings', protect, getMyListings);
router.get('/me/sold', protect, getMySoldListings);
router.get('/me/saved', protect, getMySavedListings);
router.post('/me/verification', protect, uploadVerificationDocs, submitVerification);
router.get('/me/verification', protect, getMyVerificationStatus);
router.get('/me/saved-searches', protect, getMySavedSearches);
router.post('/me/saved-searches', protect, addSavedSearch);
router.delete('/me/saved-searches/:index', protect, removeSavedSearch);
router.get('/me/notifications', protect, getMyNotifications);
router.patch('/me/notifications/:id/read', protect, markNotificationRead);
router.delete('/me/notifications/:id', protect, deleteNotification);

router.get('/search', protect, requireVerifiedStudent, searchUsers);

// Seller profiles are visible to logged-in verified students only.
router.get('/:id', protect, requireVerifiedStudent, getUserProfile);

export default router;
