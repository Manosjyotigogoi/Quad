import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Loader2Icon,
  MapPinIcon,
  MinusIcon,
  PlusIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  Trash2Icon } from
'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../utils/format';

export function Cart() {
  const { user } = useAuth();
  const { items, loading, removeFromCart, updateQuantity } = useCart();
  const navigate = useNavigate();
  const [removingId, setRemovingId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const isVerified = user?.verificationStatus === 'approved';
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleRemove = async (listingId) => {
    setRemovingId(listingId);
    try {
      await removeFromCart(listingId);
    } finally {
      setRemovingId(null);
    }
  };

  const handleStep = async (item, delta) => {
    const next = item.quantity + delta;
    if (next < 1 || next > item.stock) return;
    setUpdatingId(item.id);
    try {
      await updateQuantity(item.id, next);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-ink-950">
      <Navbar />

      <main className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col px-5 py-10 lg:px-8">
        <h1 className="text-3xl font-extrabold tracking-[-0.02em] text-chalk sm:text-4xl">
          Your cart
        </h1>

        {!isVerified ?
        <div className="mt-8 flex items-start gap-3 rounded-2xl border border-ink-700 bg-ink-850 p-5">
            <ShieldAlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-tangerine" />
            <div>
              <p className="text-sm font-semibold text-chalk">
                Verify your student ID to use the cart
              </p>
              <p className="mt-1 text-sm text-chalk-muted">
                Quad only opens buying and selling up to verified students, to
                keep the marketplace to real people on campus.
              </p>
              <Link
              to="/verify"
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-acid px-4 py-2 text-sm font-semibold text-ink-950 transition-transform duration-150 ease-smooth hover:scale-[1.03]">
              
                Verify your ID
              </Link>
            </div>
          </div> :
        loading && items.length === 0 ?
        <div className="mt-10 flex items-center justify-center rounded-card border border-dashed border-ink-600 px-6 py-16">
            <Loader2Icon className="h-5 w-5 animate-spin text-chalk-dim" />
          </div> :
        items.length === 0 ?
        <div className="mt-10 rounded-card border border-dashed border-ink-600 px-6 py-16 text-center">
            <ShoppingCartIcon className="mx-auto h-8 w-8 text-chalk-dim" />
            <p className="mt-3 text-base font-semibold text-chalk">Your cart is empty</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-chalk-muted">
              Browse the board and add something you want — it'll show up
              here.
            </p>
            <Link
            to="/#feed"
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-acid px-4 py-2 text-sm font-semibold text-ink-950 transition-transform duration-150 ease-smooth hover:scale-[1.03]">
            
              Browse the board
            </Link>
          </div> :

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
            <ul className="flex flex-col gap-4">
              {items.map((item) =>
            <li
              key={item.id}
              className="flex gap-4 rounded-card border border-ink-700 bg-ink-850 p-4">
              
                  <img
                src={item.image}
                alt={item.title}
                className="h-24 w-24 shrink-0 rounded-lg object-cover" />
                
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="truncate text-[15px] font-semibold text-chalk">
                        {item.title}
                      </h2>
                      <p className="shrink-0 font-extrabold text-acid">
                        {formatPrice(item.price * item.quantity)}
                      </p>
                    </div>
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-chalk-muted">
                      <MapPinIcon className="h-3.5 w-3.5 shrink-0" />
                      {item.pickup} · {item.condition}
                    </p>

                    <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                      <button
                    type="button"
                    onClick={() => navigate(`/sellers/${item.seller.id}`)}
                    className="flex items-center gap-1.5 truncate text-xs text-chalk-muted transition-colors duration-150 ease-smooth hover:text-chalk">
                    
                        <span className="truncate font-medium text-chalk">
                          {item.seller.name}
                        </span>
                        {item.seller.verified &&
                    <ShieldCheckIcon className="h-3.5 w-3.5 shrink-0 text-sky" aria-label="Verified student" />
                    }
                      </button>

                      <div className="flex shrink-0 items-center gap-1 rounded-full border border-ink-600">
                        <button
                      type="button"
                      onClick={() => handleStep(item, -1)}
                      disabled={item.quantity <= 1 || updatingId === item.id}
                      aria-label={`Decrease quantity of ${item.title}`}
                      className="inline-flex h-7 w-7 items-center justify-center text-chalk-muted transition-colors duration-150 ease-smooth hover:text-chalk disabled:opacity-40">
                      
                          <MinusIcon className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-5 text-center text-xs font-semibold text-chalk">
                          {updatingId === item.id ?
                      <Loader2Icon className="mx-auto h-3.5 w-3.5 animate-spin" /> :

                      item.quantity}
                        </span>
                        <button
                      type="button"
                      onClick={() => handleStep(item, 1)}
                      disabled={item.quantity >= item.stock || updatingId === item.id}
                      aria-label={`Increase quantity of ${item.title}`}
                      className="inline-flex h-7 w-7 items-center justify-center text-chalk-muted transition-colors duration-150 ease-smooth hover:text-chalk disabled:opacity-40">
                      
                          <PlusIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    disabled={removingId === item.id}
                    aria-label={`Remove ${item.title} from cart`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-chalk-muted transition-colors duration-150 ease-smooth hover:bg-ink-800 hover:text-rose disabled:opacity-60">
                    
                        {removingId === item.id ?
                    <Loader2Icon className="h-4 w-4 animate-spin" /> :

                    <Trash2Icon className="h-4 w-4" />
                    }
                      </button>
                    </div>
                    {item.quantity >= item.stock &&
                <p className="mt-1.5 text-[11px] text-chalk-dim">
                        Max available: {item.stock}
                      </p>
                }
                  </div>
                </li>
            )}
            </ul>

            <aside className="h-fit rounded-card border border-ink-700 bg-ink-850 p-5">
              <h2 className="text-sm font-semibold text-chalk">Order summary</h2>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-chalk-muted">
                  Subtotal ({items.reduce((n, i) => n + i.quantity, 0)}{' '}
                  {items.reduce((n, i) => n + i.quantity, 0) === 1 ? 'item' : 'items'})
                </span>
                <span className="font-semibold text-chalk">{formatPrice(subtotal)}</span>
              </div>
              <p className="mt-1 text-xs text-chalk-dim">
                Pickup is arranged directly with each seller — no shipping.
              </p>

              <button
              type="button"
              onClick={() => navigate('/checkout')}
              className="mt-5 w-full rounded-full bg-acid px-4 py-2.5 text-sm font-semibold text-ink-950 transition-transform duration-150 ease-smooth hover:scale-[1.02]">
              
                Checkout
              </button>
              <p className="mt-2 text-center text-xs text-chalk-dim">
                You'll pick a delivery spot and time next — sellers still
                need to accept your request.
              </p>
            </aside>
          </div>
        }
      </main>

      <Footer />
    </div>);

}
