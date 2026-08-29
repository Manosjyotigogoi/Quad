import { Router } from 'express';
import {
  getListings,
  getListingById,
  createListing,
  updateListing,
  deleteListing,
  toggleSaveListing,
  markListingSold
} from '../controllers/listingController.js';
import { protect, requireVerifiedStudent } from '../middleware/auth.js';
import { uploadListingImages } from '../middleware/upload.js';
import { etag } from '../middleware/etag.js';

const router = Router();

// Public browse + detail — no auth required (listings are visible to
// anyone landing on the site, which is the whole point of a marketplace
// landing page).
//
// THIRD-PASS OPTIMIZATION — ETag on read-only GET endpoints so cached
// clients get 304 Not Modified instead of a re-download.
router.get('/', etag, getListings);
router.get('/:id', etag, getListingById);

// Authenticated + verified-student-only actions.
router.post('/', protect, requireVerifiedStudent, uploadListingImages, createListing);
router.put('/:id', protect, uploadListingImages, updateListing);
router.delete('/:id', protect, deleteListing);

router.post('/:id/save', protect, toggleSaveListing);
router.patch('/:id/mark-sold', protect, markListingSold);

export default router;
