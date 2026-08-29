import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { Profile } from './pages/Profile';
import { NewListing } from './pages/NewListing';
import { Auth } from './pages/Auth';
import { Verify } from './pages/Verify';
import { Messages } from './pages/Messages';
import { AdminDashboard } from './pages/AdminDashboard';
import { Cart } from './pages/Cart';
import { Checkout } from './pages/Checkout';
import { Orders } from './pages/Orders';
import { SellerProfile } from './pages/SellerProfile';
import { ListingDetail } from './pages/ListingDetail';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Privacy } from './pages/Privacy';
import { Terms } from './pages/Terms';
import { Takedown } from './pages/Takedown';
import { Accessibility } from './pages/Accessibility';
import { NotFound } from './pages/NotFound';
import { useAuth } from './context/AuthContext';

function RequireAuth({ children }) {
  const { user, status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-ink-950 text-sm text-chalk-muted">
        Loading…
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/signin" replace />;
  }
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/listings/:id" element={<ListingDetail />} />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <Profile />
          </RequireAuth>
        }
      />
      <Route
        path="/listings/new"
        element={
          <RequireAuth>
            <NewListing />
          </RequireAuth>
        }
      />
      <Route
        path="/listings/:id/edit"
        element={
          <RequireAuth>
            <NewListing editMode />
          </RequireAuth>
        }
      />
      <Route
        path="/verify"
        element={
          <RequireAuth>
            <Verify />
          </RequireAuth>
        }
      />
      <Route
        path="/messages"
        element={
          <RequireAuth>
            <Messages />
          </RequireAuth>
        }
      />
      <Route
        path="/cart"
        element={
          <RequireAuth>
            <Cart />
          </RequireAuth>
        }
      />
      <Route
        path="/checkout"
        element={
          <RequireAuth>
            <Checkout />
          </RequireAuth>
        }
      />
      <Route
        path="/orders"
        element={
          <RequireAuth>
            <Orders />
          </RequireAuth>
        }
      />
      <Route
        path="/sellers/:id"
        element={
          <RequireAuth>
            <SellerProfile />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <AdminDashboard />
          </RequireAuth>
        }
      />
      <Route path="/signin" element={<Auth mode="signin" />} />
      <Route path="/signup" element={<Auth mode="signup" />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* QD-021 — Legal pages linked from every page's footer */}
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/takedown" element={<Takedown />} />
      {/* QD-023 — Accessibility statement */}
      <Route path="/accessibility" element={<Accessibility />} />
      {/* QD-030 — Real 404 page instead of a silent redirect to /. */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
