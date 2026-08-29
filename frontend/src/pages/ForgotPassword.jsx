import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckIcon,
  Loader2Icon,
  MailIcon
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Logo } from '../components/Logo';
import { api } from '../utils/api';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }
    setStatus('loading');
    try {
      await api.forgotPassword(email.trim());
      setSent(true);
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
        <div className="mb-8 lg:hidden">
          <Logo />
        </div>
        <Link
          to="/signin"
          className="inline-flex items-center gap-1.5 text-sm text-chalk-muted transition-colors hover:text-chalk"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to login
        </Link>

        {sent ? (
          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-sky/30 bg-sky/10 p-5">
            <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-sky" />
            <div>
              <p className="text-sm font-semibold text-chalk">Check your email</p>
              <p className="mt-1 text-sm text-chalk-muted">
                If an account exists for {email}, a reset link has been sent.
                The link expires in 30 minutes.
              </p>
              <Link
                to="/signin"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-acid underline decoration-acid/40 underline-offset-4"
              >
                Back to login
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-acid/10">
              <MailIcon className="h-5 w-5 text-acid" />
            </div>
            <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-chalk sm:text-4xl">
              Reset your password
            </h1>
            <p className="mt-3 text-[15px] text-chalk-muted">
              Enter your email and we'll send you a link to choose a new password.
            </p>

            <form onSubmit={handleSubmit} className="mt-9 space-y-5" noValidate>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-chalk">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@yourcollege.edu"
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
                {status === 'idle' ? 'Send reset link' : 'Sending…'}
              </button>
            </form>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
