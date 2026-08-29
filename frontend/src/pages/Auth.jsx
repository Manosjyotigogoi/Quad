import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
  Loader2Icon,
  MailIcon } from
'lucide-react';
import { Logo } from '../components/Logo';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../context/AuthContext';

const perks = [
'Message any seller the moment you verify',
'Post unlimited items with zero seller fees',
'Saved searches ping you before move-out week'];

// Keep this in lockstep with the backend's COLLEGE_EMAIL_DOMAIN (see
// backend/.env). Set VITE_COLLEGE_EMAIL_DOMAIN in the frontend's .env
// to match — this is just a UX nicety so the browser can show an error
// instantly instead of round-tripping to the server; the backend is
// still the real enforcement point. Leave both blank to fall back to
// accepting any ".edu" address, same as the backend's fallback.
const COLLEGE_EMAIL_DOMAIN = (import.meta.env.VITE_COLLEGE_EMAIL_DOMAIN || 'edu').toLowerCase();

function isAllowedSchoolEmail(email) {
  const normalized = email.trim().toLowerCase();
  // Strip any leading '.' or '@' the env var might include, then match
  // on the real email boundary: "@domain", not ".domain" — an address
  // ending in "@gmail.com" does NOT end in ".gmail.com".
  const domain = COLLEGE_EMAIL_DOMAIN.replace(/^[.@]/, '');
  return normalized.endsWith(`@${domain}`) || normalized.endsWith('.edu');
}

export function Auth({ mode }) {
  const navigate = useNavigate();
  const { register, verifyOtp, resendOtp, login } = useAuth();
  const isSignUp = mode === 'signup';

  // 'form' = name/email/phone/password step, 'otp' = code-entry step
  // (only ever reached from signup — login goes straight through).
  const [step, setStep] = useState('form');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [resendStatus, setResendStatus] = useState('idle');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (isSignUp && name.trim().length < 2) {
      setError('Add the name your classmates will see.');
      return;
    }
    if (!isAllowedSchoolEmail(email)) {
      setError('Use your school email to sign up.');
      return;
    }
    if (isSignUp && phone.trim().length < 7) {
      setError('Add a phone number so buyers and sellers can reach you.');
      return;
    }
    if (password.length < 8) {
      setError('Passwords need at least 8 characters.');
      return;
    }

    setStatus('loading');
    try {
      if (isSignUp) {
        await register({ name: name.trim(), email: email.trim(), phone: phone.trim(), password });
        setStatus('idle');
        setStep('otp');
      } else {
        await login({ email: email.trim(), password });
        setStatus('done');
        window.setTimeout(() => navigate('/profile'), 600);
      }
    } catch (err) {
      setStatus('idle');
      setError(err.message);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    setError(null);

    if (otp.trim().length < 4) {
      setError('Enter the code we emailed you.');
      return;
    }

    setStatus('loading');
    try {
      await verifyOtp({ email: email.trim(), otp: otp.trim() });
      setStatus('done');
      window.setTimeout(() => navigate('/profile'), 600);
    } catch (err) {
      setStatus('idle');
      setError(err.message);
    }
  };

  const handleResend = async () => {
    setResendStatus('loading');
    setError(null);
    try {
      await resendOtp({ email: email.trim() });
      setResendStatus('sent');
      window.setTimeout(() => setResendStatus('idle'), 3000);
    } catch (err) {
      setResendStatus('idle');
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen w-full bg-ink-950 lg:grid lg:grid-cols-[1fr_1.05fr]">
      <aside className="hidden flex-col justify-between border-r border-ink-700/70 bg-ink-900 p-12 lg:flex">
        <Logo />

        <div>
          <h2 className="max-w-md text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em] text-chalk">
            One campus. One password.{' '}
            <span className="text-acid">No strangers.</span>
          </h2>
          <ul className="mt-9 space-y-4">
            {perks.map((perk) =>
            <li key={perk} className="flex items-start gap-3">
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-acid" />
                <span className="text-[15px] leading-relaxed text-chalk-muted">
                  {perk}
                </span>
              </li>
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-ink-700 bg-ink-850 p-6">
          <p className="text-[15px] leading-relaxed text-chalk">
            “I furnished my whole single for $140 and sold it all back in May.
            Quad is basically the group chat with prices.”
          </p>
          <div className="mt-5 flex items-center gap-3">
            <Avatar initials="LK" accent="grape" />
            <div>
              <p className="text-sm font-semibold text-chalk">Leah Kim</p>
              <p className="text-xs text-chalk-dim">
                Graduate Towers · 27 items sold
              </p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex min-h-screen flex-col justify-center px-5 py-12 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>

          {step === 'otp' ?
          <button
            type="button"
            onClick={() => {
              setStep('form');
              setError(null);
            }}
            className="inline-flex items-center gap-1.5 text-sm text-chalk-muted transition-colors duration-150 ease-smooth hover:text-chalk">
            
              <ArrowLeftIcon className="h-4 w-4" />
              Back
            </button> :

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-chalk-muted transition-colors duration-150 ease-smooth hover:text-chalk">
            
              <ArrowLeftIcon className="h-4 w-4" />
              Back to the board
            </Link>
          }

          {step === 'form' ?
          <>
              <h1 className="mt-6 text-3xl font-extrabold tracking-[-0.02em] text-chalk sm:text-4xl">
                {isSignUp ? 'Claim your campus account' : 'Welcome back'}
              </h1>
              <p className="mt-3 text-[15px] text-chalk-muted">
                {isSignUp ?
              'Verify your school email and start buying or selling on your campus today.' :
              'Log in to pick up where you left off — messages, saved items, and your listings.'}
              </p>

              <form onSubmit={handleSubmit} className="mt-9 space-y-5" noValidate>
                {isSignUp &&
              <div>
                    <label
                  htmlFor="name"
                  className="block text-sm font-medium text-chalk">
                  
                      Full name
                    </label>
                    <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Priya Raman"
                  className="mt-2 w-full rounded-xl border border-ink-600 bg-ink-850 px-4 py-3 text-[15px] text-chalk placeholder:text-chalk-dim transition-colors duration-150 ease-smooth hover:border-ink-500 focus:border-acid focus:outline-none" />
                
                  </div>
              }

                <div>
                  <label
                  htmlFor="email"
                  className="block text-sm font-medium text-chalk">
                  
                  School email
                </label>
                  <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@westbrook.edu"
                  className="mt-2 w-full rounded-xl border border-ink-600 bg-ink-850 px-4 py-3 text-[15px] text-chalk placeholder:text-chalk-dim transition-colors duration-150 ease-smooth hover:border-ink-500 focus:border-acid focus:outline-none" />
                
                </div>

                {isSignUp &&
              <div>
                    <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-chalk">
                  
                      Phone number
                    </label>
                    <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 010-2938"
                  className="mt-2 w-full rounded-xl border border-ink-600 bg-ink-850 px-4 py-3 text-[15px] text-chalk placeholder:text-chalk-dim transition-colors duration-150 ease-smooth hover:border-ink-500 focus:border-acid focus:outline-none" />
                
                  </div>
              }

                <div>
                  <div className="flex items-baseline justify-between">
                    <label
                    htmlFor="password"
                    className="block text-sm font-medium text-chalk">
                    
                    Password
                  </label>
                    {!isSignUp &&
                  <Link
                    to="/forgot-password"
                    className="text-[13px] text-chalk-muted transition-colors duration-150 ease-smooth hover:text-chalk">

                      Forgot password?
                    </Link>
                  }
                  </div>
                  <div className="relative mt-2">
                    <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full rounded-xl border border-ink-600 bg-ink-850 px-4 py-3 pr-12 text-[15px] text-chalk placeholder:text-chalk-dim transition-colors duration-150 ease-smooth hover:border-ink-500 focus:border-acid focus:outline-none" />
                  
                    <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-chalk-dim transition-colors duration-150 ease-smooth hover:text-chalk">
                    
                    {showPassword ?
                    <EyeOffIcon className="h-4 w-4" /> :

                    <EyeIcon className="h-4 w-4" />
                    }
                  </button>
                  </div>
                </div>

                {error &&
              <motion.p
                role="alert"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                className="flex items-start gap-2 rounded-xl bg-rose/10 px-3.5 py-3 text-sm text-rose">
                
                  <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </motion.p>
              }

                <button
                type="submit"
                disabled={status !== 'idle'}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-acid px-6 py-3.5 text-[15px] font-semibold text-ink-950 transition-transform duration-150 ease-smooth hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100">
                
                {status === 'loading' &&
                <Loader2Icon className="h-4 w-4 animate-spin" />
                }
                {status === 'done' && <CheckIcon className="h-4 w-4" />}
                {status === 'idle' ?
                isSignUp ?
                'Create account' :
                'Log in' :
                status === 'loading' ?
                isSignUp ? 'Creating your account…' : 'Checking your email…' :
                'Verified — opening Quad'}
              </button>
              </form>

              <p className="mt-7 text-sm text-chalk-muted">
                {isSignUp ? 'Already on Quad?' : 'New to campus?'}{' '}
                <Link
                to={isSignUp ? '/signin' : '/signup'}
                className="font-semibold text-acid underline decoration-acid/40 underline-offset-4 transition-colors duration-150 ease-smooth hover:decoration-acid">
                
                {isSignUp ? 'Log in instead' : 'Create an account'}
              </Link>
              </p>

              <p className="mt-8 text-xs leading-relaxed text-chalk-dim">
                Quad only verifies that your email belongs to your school. We never
                post to your account or share your address with buyers.
              </p>
            </> :


          <>
              <div className="mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-acid/10">
                <MailIcon className="h-5 w-5 text-acid" />
              </div>
              <h1 className="mt-5 text-3xl font-extrabold tracking-[-0.02em] text-chalk sm:text-4xl">
                Check your inbox
              </h1>
              <p className="mt-3 text-[15px] text-chalk-muted">
                We sent a verification code to{' '}
                <span className="font-medium text-chalk">{email}</span>. Enter it
                below to finish creating your account.
              </p>

              <form onSubmit={handleVerifyOtp} className="mt-9 space-y-5" noValidate>
                <div>
                  <label
                  htmlFor="otp"
                  className="block text-sm font-medium text-chalk">
                  
                  Verification code
                </label>
                  <div className="relative mt-2">
                    <KeyRoundIcon className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-chalk-dim" />
                    <input
                    id="otp"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="6-digit code"
                    className="w-full rounded-xl border border-ink-600 bg-ink-850 py-3 pl-11 pr-4 text-[15px] tracking-[0.3em] text-chalk placeholder:tracking-normal placeholder:text-chalk-dim transition-colors duration-150 ease-smooth hover:border-ink-500 focus:border-acid focus:outline-none" />
                  
                  </div>
                </div>

                {error &&
              <motion.p
                role="alert"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                className="flex items-start gap-2 rounded-xl bg-rose/10 px-3.5 py-3 text-sm text-rose">
                
                  <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </motion.p>
              }

                <button
                type="submit"
                disabled={status !== 'idle'}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-acid px-6 py-3.5 text-[15px] font-semibold text-ink-950 transition-transform duration-150 ease-smooth hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100">
                
                {status === 'loading' &&
                <Loader2Icon className="h-4 w-4 animate-spin" />
                }
                {status === 'done' && <CheckIcon className="h-4 w-4" />}
                {status === 'idle' ? 'Verify & continue' : status === 'loading' ? 'Verifying…' : 'Verified — opening Quad'}
              </button>
              </form>

              <p className="mt-7 text-sm text-chalk-muted">
                Didn’t get a code?{' '}
                <button
                type="button"
                onClick={handleResend}
                disabled={resendStatus === 'loading'}
                className="font-semibold text-acid underline decoration-acid/40 underline-offset-4 transition-colors duration-150 ease-smooth hover:decoration-acid disabled:opacity-60">
                
                {resendStatus === 'idle' && 'Resend code'}
                {resendStatus === 'loading' && 'Sending…'}
                {resendStatus === 'sent' && 'Sent — check your inbox'}
              </button>
              </p>
            </>
          }
        </div>
      </main>
    </div>);

}