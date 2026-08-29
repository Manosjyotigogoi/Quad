import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../utils/api';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

function toCardListing(listing, cartQuantity) {
  return {
    id: listing._id,
    title: listing.title,
    price: listing.price,
    wasPrice: listing.wasPrice || undefined,
    condition: listing.condition,
    category: listing.category,
    image: listing.images?.[0]?.url || '/vite.svg',
    pickup: listing.pickupSpot,
    quantity: cartQuantity,
    stock: listing.quantity ?? 1,
    seller: {
      id: listing.seller?._id,
      name: listing.seller?.name || 'Former student',
      dorm: listing.seller?.dorm || '',
      rating: listing.seller?.rating,
      verified: listing.seller?.verification?.status === 'approved'
    }
  };
}

function storageKey(userId) {
  return `quad_cart_${userId}`;
}

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Hydrate instantly from the last-known cache for this user so the
  // cart icon/count don't flash empty on every reload, then reconcile
  // with the server in the background.
  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    // Only hydrate from cache if it belongs to THIS user — prevents the
    // previous user's cart from flashing when a different user logs in
    // on the same browser. AuthContext.logout already clears the cache
    // on explicit logout, but this double-checks on every user change.
    try {
      const cached = window.localStorage.getItem(storageKey(user.id));
      if (cached) setItems(JSON.parse(cached));
    } catch {
      // Corrupt/unavailable cache — fine, the server fetch below is the
      // source of truth.
    }

    let cancelled = false;
    setLoading(true);
    api
      .getCart()
      .then((data) => {
        if (cancelled) return;
        const cards = (data.items || [])
          .filter((entry) => entry.listing)
          .map((entry) => toCardListing(entry.listing, entry.quantity));
        setItems(cards);
      })
      .catch(() => {
        // Not verified yet, or a transient error — leave the cached
        // items (if any) in place rather than clearing the cart.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    try {
      window.localStorage.setItem(storageKey(user.id), JSON.stringify(items));
    } catch {
      // Storage full/unavailable — non-fatal, server stays authoritative.
    }
  }, [items, user]);

  const applyCartResponse = (data) => {
    const cards = (data.items || [])
      .filter((entry) => entry.listing)
      .map((entry) => toCardListing(entry.listing, entry.quantity));
    setItems(cards);
    return cards;
  };

  const addToCart = async (listingId, quantity = 1) => {
    const data = await api.addToCart(listingId, quantity);
    applyCartResponse(data);
  };

  const updateQuantity = async (listingId, quantity) => {
    const data = await api.updateCartItemQuantity(listingId, quantity);
    applyCartResponse(data);
  };

  const removeFromCart = async (listingId) => {
    const data = await api.removeFromCart(listingId);
    applyCartResponse(data);
  };

  const clearCart = async () => {
    await api.clearCart();
    setItems([]);
  };

  const refreshCart = async () => {
    const data = await api.getCart();
    applyCartResponse(data);
  };

  const isInCart = (listingId) => items.some((item) => item.id === listingId);

  return (
    <CartContext.Provider
      value={{
        items,
        count: items.length,
        loading,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        refreshCart,
        isInCart
      }}>
      
      {children}
    </CartContext.Provider>);

}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside a CartProvider');
  return ctx;
}
