import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../utils/api';
import { connectSocket, disconnectSocket } from '../utils/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    api.me()
      .then((data) => {
        if (!cancelled) {
          setUser(data.user);
          // Connect Socket.io once we know the user is logged in.
          connectSocket();
        }
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setStatus('ready');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const register = async ({ name, email, phone, password }) => {
    return api.register({ name, email, phone, password });
  };

  const verifyOtp = async ({ email, otp }) => {
    const data = await api.verifyOtp({ email, otp });
    setUser(data.user);
    connectSocket();
    return data.user;
  };

  const resendOtp = async ({ email }) => {
    return api.resendOtp({ email });
  };

  const login = async ({ email, password }) => {
    const data = await api.login({ email, password });
    setUser(data.user);
    connectSocket();
    return data.user;
  };

  const logout = async () => {
    // Clear any per-user cached state BEFORE the server clears the
    // cookie, so a subsequent login by a DIFFERENT user on the same
    // browser doesn't briefly flash the previous user's cart.
    try {
      const userId = user?.id;
      if (userId) {
        window.localStorage.removeItem(`quad_cart_${userId}`);
      }
    } catch {
      // Non-fatal.
    }
    disconnectSocket();
    await api.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    const data = await api.me();
    setUser(data.user);
    return data.user;
  };

  return (
    <AuthContext.Provider
      value={{ user, status, register, verifyOtp, resendOtp, login, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
}
