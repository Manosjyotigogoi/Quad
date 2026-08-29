// Matches backend/utils/generateToken.js — keeps the cookie name in
// sync without importing the backend's env directly.
export const COOKIE_NAME = 'quad_token';

// Best-effort cookie reader for non-httpOnly cookies (e.g. a theme cookie).
// The auth cookie IS httpOnly and can't be read here — that's by design.
export function getCookie(name) {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}
