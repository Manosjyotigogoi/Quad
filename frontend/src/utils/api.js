// Base URL of the Quad backend. Set VITE_API_URL in a .env file if the
// API isn't running on the default local port (see .env.example).
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Thin wrapper around fetch for talking to the Quad API.
 * - Always sends credentials so the httpOnly `quad_token` cookie is
 *   included on every request and can be set/cleared by the server.
 * - Always sends the X-Requested-With header — required by the
 *   backend's CSRF protection (see backend/middleware/csrf.js).
 * - Throws an Error with the server's message on non-2xx responses,
 *   so callers can just try/catch and show err.message.
 */
async function request(path, { method = 'GET', body } = {}) {
  const isFormData = body instanceof FormData;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: {
      'X-Requested-With': 'XMLHttpRequest', // CSRF protection
      ...(body && !isFormData ? { 'Content-Type': 'application/json' } : {})
    },
    body: isFormData ? body : body ? JSON.stringify(body) : undefined
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Some responses (e.g. 204) may not have a JSON body.
  }

  if (!res.ok) {
    const message = data?.message || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data;
}

export const api = {
  // Auth
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  verifyOtp: (payload) => request('/auth/verify-otp', { method: 'POST', body: payload }),
  resendOtp: (payload) => request('/auth/resend-otp', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (token, password) => request('/auth/reset-password', { method: 'POST', body: { token, password } }),
  changePassword: (currentPassword, newPassword) =>
    request('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),

  // Listings
  getListings: ({ category, q, minPrice, maxPrice, condition, verifiedOnly, sort, page, limit } = {}) => {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.set('category', category);
    if (q) params.set('q', q);
    if (minPrice !== undefined && minPrice !== '') params.set('minPrice', minPrice);
    if (maxPrice !== undefined && maxPrice !== '') params.set('maxPrice', maxPrice);
    if (condition && condition !== 'all') params.set('condition', condition);
    if (verifiedOnly) params.set('verifiedOnly', 'true');
    if (sort) params.set('sort', sort);
    if (page) params.set('page', page);
    if (limit) params.set('limit', limit);
    const qs = params.toString();
    return request(`/listings${qs ? `?${qs}` : ''}`);
  },
  getListing: (id) => request(`/listings/${id}`),
  createListing: (formData) => request('/listings', { method: 'POST', body: formData }),
  updateListing: (id, formData) => request(`/listings/${id}`, { method: 'PUT', body: formData }),
  deleteListing: (id) => request(`/listings/${id}`, { method: 'DELETE' }),
  toggleSaveListing: (id) => request(`/listings/${id}/save`, { method: 'POST' }),
  markListingSold: (id) => request(`/listings/${id}/mark-sold`, { method: 'PATCH' }),

  // The logged-in user's own listings/reviews (Profile page tabs)
  getMyListings: () => request('/users/me/listings'),
  getMySoldListings: () => request('/users/me/sold'),
  getMySavedListings: () => request('/users/me/saved'),
  getUserReviews: (userId) => request(`/reviews/seller/${userId}`),
  // Post a review for a listing you've completed an order on.
  // The backend re-verifies the completed order, so no need to send it.
  createReview: ({ listingId, rating, body }) =>
    request('/reviews', { method: 'POST', body: { listingId, rating, body } }),

  // Seller profile
  getUserProfile: (userId) => request(`/users/${userId}`),
  searchUsers: (q) => request(`/users/search?q=${encodeURIComponent(q)}`),
  updateMyProfile: (payload) => request('/users/me', { method: 'PUT', body: payload }),

  // Saved searches (watch alerts)
  getMySavedSearches: () => request('/users/me/saved-searches'),
  addSavedSearch: (payload) => request('/users/me/saved-searches', { method: 'POST', body: payload }),
  removeSavedSearch: (index) => request(`/users/me/saved-searches/${index}`, { method: 'DELETE' }),

  // Notifications
  getMyNotifications: () => request('/users/me/notifications'),
  markNotificationRead: (id) => request(`/users/me/notifications/${id}/read`, { method: 'PATCH' }),
  deleteNotification: (id) => request(`/users/me/notifications/${id}`, { method: 'DELETE' }),

  // Cart
  getCart: () => request('/cart'),
  addToCart: (listingId, quantity = 1) => request(`/cart/${listingId}`, { method: 'POST', body: { quantity } }),
  updateCartItemQuantity: (listingId, quantity) =>
    request(`/cart/${listingId}`, { method: 'PATCH', body: { quantity } }),
  removeFromCart: (listingId) => request(`/cart/${listingId}`, { method: 'DELETE' }),
  clearCart: () => request('/cart', { method: 'DELETE' }),

  // Orders
  createOrders: ({ deliveryLocation, deliveryTime }) =>
    request('/orders', { method: 'POST', body: { deliveryLocation, deliveryTime } }),
  getMyOrders: () => request('/orders/mine'),
  getReceivedOrders: () => request('/orders/received'),
  acceptOrder: (orderId) => request(`/orders/${orderId}/accept`, { method: 'PATCH' }),
  rejectOrder: (orderId) => request(`/orders/${orderId}/reject`, { method: 'PATCH' }),
  completeOrder: (orderId) => request(`/orders/${orderId}/complete`, { method: 'PATCH' }),
  cancelOrder: (orderId) => request(`/orders/${orderId}`, { method: 'DELETE' }),

  // Verification
  submitVerification: (formData) => request('/users/me/verification', { method: 'POST', body: formData }),
  getMyVerificationStatus: () => request('/users/me/verification'),

  // Messaging
  getMyConversations: () => request('/messages/conversations'),
  startConversation: ({ recipientId, listingId }) =>
    request('/messages/conversations', { method: 'POST', body: { recipientId, listingId } }),
  getMessages: (conversationId) => request(`/messages/conversations/${conversationId}`),
  sendMessage: (conversationId, text) =>
    request(`/messages/conversations/${conversationId}`, { method: 'POST', body: { text } }),
  markConversationRead: (conversationId) =>
    request(`/messages/conversations/${conversationId}/read`, { method: 'PATCH' }),

  // Admin
  getAdminStats: () => request('/admin/stats'),
  getAdminVerifications: (status = 'pending') =>
    request(`/admin/verifications?status=${encodeURIComponent(status)}`),
  reviewVerification: (userId, action, reason) =>
    request(`/admin/verifications/${userId}`, { method: 'PATCH', body: { action, reason } }),
  // QD-015 — paginated read-only audit log of every admin verification action.
  getAuditLog: ({ page = 1, limit = 25, targetUserId, action } = {}) => {
    const params = new URLSearchParams();
    params.set('page', page);
    params.set('limit', limit);
    if (targetUserId) params.set('targetUserId', targetUserId);
    if (action) params.set('action', action);
    return request(`/admin/audit-log?${params.toString()}`);
  },

  // Categories — fetched from the API, not hardcoded.
  getCategories: () => request('/categories')
};
