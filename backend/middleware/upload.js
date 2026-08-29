import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';
import { withCircuit, cloudinaryBreaker } from './circuitBreaker.js';

const MAX_DIMENSION = 4000; // px — reject absurdly large images
const MIN_DIMENSION = 100; // px — reject tiny / placeholder images

const imageFileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new Error('Only image files are allowed'), false);
  }
  // Restrict to JPEG / PNG / WebP — matches Cloudinary's allowed_formats.
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error('Images must be JPEG, PNG, or WebP'), false);
  }
  cb(null, true);
};

// Public-ish images: avatars and listing photos.
const publicStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: file.fieldname === 'avatar' ? 'quad/avatars' : 'quad/listings',
    resource_type: 'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp']
  })
});

// Verification documents: ID card + Aadhar card. Uploaded as
// type "authenticated" so Cloudinary will not serve them from a
// public URL — see config/cloudinary.js for the signed-URL helper.
const verificationStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: 'quad/verification',
    resource_type: 'image',
    type: 'authenticated',
    allowed_formats: ['jpg', 'jpeg', 'png']
  })
});

// Post-upload hook: validates image dimensions by fetching the
// Cloudinary metadata for the just-uploaded file. Cloudinary's
// multer-storage-cloudinary returns { path, filename } — we use the
// filename (public_id) to fetch the resource info.
async function validateImageDimensions(req, res, next) {
  // Only validate if there are uploaded files and the route opted in
  // via res.locals.validateImageDimensions === true.
  if (!res.locals.validateImageDimensions) return next();

  const files = [];
  if (req.file) files.push(req.file);
  if (req.files) {
    if (Array.isArray(req.files)) files.push(...req.files);
    else Object.values(req.files).forEach((arr) => files.push(...arr));
  }

  try {
    for (const file of files) {
      if (!file.filename) continue;
      // THIRD-PASS HARDENING — wrap Cloudinary calls in the circuit breaker
      // so a Cloudinary outage doesn't hang every upload request.
      const info = await withCircuit(cloudinaryBreaker, () =>
        cloudinary.api.resource(file.filename, { resource_type: 'image' })
      );
      const { width, height } = info;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        // Best-effort: delete the oversized upload so we don't orphane it.
        await cloudinary.uploader.destroy(file.filename).catch(() => {});
        res.status(400);
        return next(new Error(`Image "${file.originalname}" is too large (${width}×${height}px). Max ${MAX_DIMENSION}px per side.`));
      }
      if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
        await cloudinary.uploader.destroy(file.filename).catch(() => {});
        res.status(400);
        return next(new Error(`Image "${file.originalname}" is too small (${width}×${height}px). Min ${MIN_DIMENSION}px per side.`));
      }
    }
    next();
  } catch (err) {
    if (err.code === 'CIRCUIT_OPEN') {
      res.status(503);
      return next(new Error('Image service is temporarily unavailable. Please try again in a moment.'));
    }
    // If the metadata fetch fails (network, Cloudinary rate limit),
    // don't block the upload — the file filter already caught non-images.
    next();
  }
}

export const uploadAvatar = (req, res, next) => {
  res.locals.validateImageDimensions = true;
  const upload = multer({
    storage: publicStorage,
    fileFilter: imageFileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
  }).single('avatar');
  upload(req, res, (err) => {
    if (err) return next(err);
    validateImageDimensions(req, res, next);
  });
};

export const uploadListingImages = (req, res, next) => {
  res.locals.validateImageDimensions = true;
  const upload = multer({
    storage: publicStorage,
    fileFilter: imageFileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
  }).array('images', 6);
  upload(req, res, (err) => {
    if (err) return next(err);
    validateImageDimensions(req, res, next);
  });
};

export const uploadVerificationDocs = (req, res, next) => {
  res.locals.validateImageDimensions = true;
  const upload = multer({
    storage: verificationStorage,
    fileFilter: imageFileFilter,
    limits: { fileSize: 8 * 1024 * 1024 }
  }).fields([
    { name: 'idCard', maxCount: 1 },
    { name: 'aadharCard', maxCount: 1 }
  ]);
  upload(req, res, (err) => {
    if (err) return next(err);
    validateImageDimensions(req, res, next);
  });
};
