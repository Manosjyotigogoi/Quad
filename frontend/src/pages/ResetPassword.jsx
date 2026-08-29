import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { api } from '../utils/api';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError('This reset link is invalid or expired. Please request a new one.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords don\'t match.');
      return;
    }
    setStatus('loading');
    try {
      await api.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/signin'), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setStatus('idle');
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-ink-950">
      <Navbar />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12 sm:px-10">
        <Link
          to="/signin"
          className="inline-flex items-center gap-1.5 text-sm text-chalk-muted transition-colors hover:text-chalk"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to login
        </Link>

        {done ? (
          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-acid/30 bg-acid/10 p-5">
            <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-acid" />
            <div>
              <p className="text-sm font-semibold text-chalk">Password updated</p>
              <p className="mt-1 text-sm text-chalk-muted">
                You can now log in with your new password.
              </p>
            </div>
          </div>
        ) : (
          <>
            <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-chalk sm:text-4xl">
              Choose a new password
            </h1>
            <p className="mt-3 text-[15px] text-chalk-muted">
              Enter your new password below.
            </p>

            <form onSubmit={handleSubmit} className="mt-9 space-y-5" noValidate>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-chalk">
                  New password
                </label>
                <div className="relative mt-2">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full rounded-xl border border-ink-600 bg-ink-850 px-4 py-3 pr-12 text-[15px] text-chalk placeholder:text-chalk-dim transition-colors hover:border-ink-500 focus:border-acid focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-chalk-dim transition-colors hover:text-chalk"
                  >
                    {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm" className="block text-sm font-medium text-chalk">
                  Confirm password
                </label>
                <input
                  id="confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter your new password"
                  className="mt-2 w-full rounded-xl border border-ink-600 bg-ink-850 px-4 py-3 text-[15px] text-chalk placeholder:text-chalk-dim transition-colors hover:border-ink-500 focus:border-acid focus:outline-none"
                />
              </div>

              {error && (
                <motion.p
                  role="alert"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 rounded-xl bg-rose/10 px-3.5 py-3 text-sm text-rose"
                >
                  <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={status !== 'idle'}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-acid px-6 py-3.5 text-[15px] font-semibold text-ink-950 transition-transform hover:scale-[1.01] disabled:opacity-70"
              >
                {status === 'loading' && <Loader2Icon className="h-4 w-4 animate-spin" />}
                {status === 'idle' ? 'Reset password' : 'Resetting…'}
              </button>
            </form>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
