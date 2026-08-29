import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

/**
 * Verification documents (ID card, Aadhar card) are uploaded with
 * type: 'authenticated' so they are NOT publicly reachable by URL —
 * only a signed, time-limited link (generated below) can view them.
 * Only the admin controller ever calls getSignedVerificationUrl().
 *
 * Detects the original format from the public_id extension so PNG
 * uploads don't break the signed-URL fetch.
 */
export function getSignedVerificationUrl(publicId, { expiresInSeconds = 300 } = {}) {
  const timestamp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  // Detect format from extension, default to jpg.
  const ext = (publicId.split('.').pop() || 'jpg').toLowerCase();
  const format = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
  return cloudinary.utils.private_download_url(publicId, format, {
    resource_type: 'image',
    type: 'authenticated',
    expires_at: timestamp
  });
}

/**
 * THIRD-PASS OPTIMIZATION — Cloudinary image transformations for
 * listing photos. Returns a URL that asks Cloudinary to:
 *   - convert to WebP/AVIF if the browser supports it (f_auto)
 *   - serve a quality-balanced version (q_auto)
 *   - resize to a max width (default 800px for cards, 1200px for detail)
 *
 * Bandwidth savings are typically 60-80% vs serving the raw upload
 * (a 4MB iPhone photo becomes a 100-200KB WebP). The original is
 * still stored untouched for admin/audit access.
 *
 * If the URL is NOT a Cloudinary URL (e.g. dev fallback), returns
 * the original URL unchanged.
 */
export function getOptimizedImageUrl(url, { width = 800 } = {}) {
  if (!url || typeof url !== 'string') return url;
  // Only transform Cloudinary URLs — leave dev/placeholder URLs alone.
  if (!url.includes('res.cloudinary.com')) return url;
  // Insert /upload/f_auto,q_auto,w_<width>/ right after /upload/.
  // The URL is of the form:
  //   https://res.cloudinary.com/<cloud>/image/upload/v<version>/<public_id>
  // We split at /upload/ and rejoin with the transformation options.
  const parts = url.split('/upload/');
  if (parts.length !== 2) return url;
  return `${parts[0]}/upload/f_auto,q_auto,w_${width}/${parts[1]}`;
}

export default cloudinary;
