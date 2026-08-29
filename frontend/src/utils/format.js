export function formatPrice(price) {
  if (price === 0) return 'Free';
  return `$${price.toLocaleString('en-US')}`;
}

export function formatRating(rating) {
  return (rating || 0).toFixed(1);
}

// "PR" from "Priya Raman" — used anywhere we need an avatar fallback
// for the logged-in user or a reviewer.
export function getInitials(name = '') {
  return name.
  trim().
  split(/\s+/).
  slice(0, 2).
  map((part) => part[0]?.toUpperCase() ?? '').
  join('') || '?';
}

// Turns a Mongo createdAt timestamp into "12 min ago" / "3 hrs ago" /
// "2 weeks ago", matching the style the original sample data used.
export function formatRelativeTime(dateInput) {
  const date = new Date(dateInput);
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

  const units = [
  { label: 'yr', secs: 31536000 },
  { label: 'month', secs: 2592000 },
  { label: 'week', secs: 604800 },
  { label: 'day', secs: 86400 },
  { label: 'hr', secs: 3600 },
  { label: 'min', secs: 60 }];


  for (const unit of units) {
    const value = Math.floor(seconds / unit.secs);
    if (value >= 1) {
      return `${value} ${unit.label}${value > 1 ? 's' : ''} ago`;
    }
  }
  return 'just now';
}