import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckIcon,
  ClockIcon,
  IdCardIcon,
  Loader2Icon,
  ShieldCheckIcon,
  UploadIcon,
  XIcon } from
'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

// One of the two document upload tiles (ID card / Aadhar card) — kept
// as a small local component since the two fields are identical apart
// from labels and the file they hold.
function DocTile({ label, hint, file, onChange, onRemove, inputId }) {
  return (
    <div>
      <p className="block text-sm font-medium text-chalk">{label}</p>
      <p className="mt-1 text-xs text-chalk-dim">{hint}</p>
      {file ?
      <div className="group relative mt-2 h-40 w-full overflow-hidden rounded-xl border border-ink-600">
          <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
          <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink-950/80 text-chalk">
          
            <XIcon className="h-4 w-4" />
          </button>
        </div> :

      <label
        htmlFor={inputId}
        className="mt-2 flex h-40 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ink-600 text-chalk-dim transition-colors duration-150 ease-smooth hover:border-ink-500 hover:text-chalk-muted">
        
          <UploadIcon className="h-5 w-5" />
          <span className="text-xs">Tap to upload a photo</span>
          <input
          id={inputId}
          type="file"
          accept="image/*"
          onChange={onChange}
          className="hidden" />
        
        </label>
      }
    </div>);

}

export function Verify() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  const [registrationNo, setRegistrationNo] = useState('');
  const [idCard, setIdCard] = useState(null);
  const [aadharCard, setAadharCard] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | done
  const [error, setError] = useState(null);

  const [checking, setChecking] = useState(true);
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.getMyVerificationStatus().
    then((data) => {
      if (!cancelled) setCurrent(data);
    }).
    catch(() => {}).
    finally(() => {
      if (!cancelled) setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (!registrationNo.trim()) {
      setError('Enter your student registration number.');
      return;
    }
    if (!idCard) {
      setError('Upload a photo of your student ID card.');
      return;
    }
    if (!aadharCard) {
      setError('Upload a photo of your Aadhar card.');
      return;
    }

    setStatus('loading');
    try {
      const formData = new FormData();
      formData.append('registrationNo', registrationNo.trim());
      formData.append('idCard', idCard);
      formData.append('aadharCard', aadharCard);

      await api.submitVerification(formData);
      await refreshUser();
      setStatus('done');
      window.setTimeout(() => navigate('/profile'), 900);
    } catch (err) {
      setStatus('idle');
      setError(err.message);
    }
  };

  const alreadyApproved = current?.status === 'approved';
  const alreadyPending = current?.status === 'pending';

  return (
    <div className="min-h-screen w-full bg-ink-950">
      <Navbar />

      <main className="mx-auto w-full max-w-2xl px-5 py-12 lg:px-8 lg:py-16">
        <Link
          to="/profile"
          className="inline-flex items-center gap-1.5 text-sm text-chalk-muted transition-colors duration-150 ease-smooth hover:text-chalk">
          
          <ArrowLeftIcon className="h-4 w-4" />
          Back to profile
        </Link>

        <h1 className="mt-6 text-3xl font-extrabold tracking-[-0.02em] text-chalk sm:text-4xl">
          Verify your student ID
        </h1>
        <p className="mt-3 text-[15px] text-chalk-muted">
          Quad only allows verified students to post listings and message each
          other. Upload your student ID and Aadhar card — an admin reviews
          submissions by hand, usually within a day or two.
        </p>

        {checking ?
        <div className="mt-8 rounded-2xl border border-dashed border-ink-600 px-6 py-10 text-center">
            <p className="text-sm text-chalk-muted">Checking your status…</p>
          </div> :
        alreadyApproved ?
        <div className="mt-8 flex items-start gap-3 rounded-2xl border border-sky/30 bg-sky/10 p-5">
            <ShieldCheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-sky" />
            <div>
              <p className="text-sm font-semibold text-chalk">
                You're already a verified student
              </p>
              <p className="mt-1 text-sm text-chalk-muted">
                Nothing else to do here —{' '}
                <Link to="/profile" className="font-medium text-acid underline decoration-acid/40 underline-offset-4">
                  head back to your profile
                </Link>
                .
              </p>
            </div>
          </div> :
        alreadyPending ?
        <div className="mt-8 flex items-start gap-3 rounded-2xl border border-ink-700 bg-ink-850 p-5">
            <ClockIcon className="mt-0.5 h-5 w-5 shrink-0 text-tangerine" />
            <div>
              <p className="text-sm font-semibold text-chalk">
                Your submission is under review
              </p>
              <p className="mt-1 text-sm text-chalk-muted">
                Registration no. {current.registrationNo} — an admin will
                approve or reject it soon. You can resubmit below if you need
                to fix something.
              </p>
            </div>
          </div> :
        current?.status === 'rejected' &&
        <div className="mt-8 flex items-start gap-3 rounded-2xl border border-rose/30 bg-rose/10 p-5">
            <AlertCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-rose" />
            <div>
              <p className="text-sm font-semibold text-chalk">
                Your last submission was rejected
              </p>
              <p className="mt-1 text-sm text-chalk-muted">
                {current.rejectionReason || 'No reason was given.'} Fix the
                issue and resubmit below.
              </p>
            </div>
          </div>
        }

        {!checking && !alreadyApproved &&
        <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <div>
              <label htmlFor="registrationNo" className="block text-sm font-medium text-chalk">
                Registration number
              </label>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-ink-600 bg-ink-850 px-4 py-3 transition-colors duration-150 ease-smooth hover:border-ink-500 focus-within:border-acid">
                <IdCardIcon className="h-4 w-4 shrink-0 text-chalk-dim" />
                <input
                id="registrationNo"
                type="text"
                value={registrationNo}
                onChange={(e) => setRegistrationNo(e.target.value)}
                placeholder="e.g. 22CS1042"
                className="w-full bg-transparent text-[15px] text-chalk placeholder:text-chalk-dim focus:outline-none" />
              
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <DocTile
              label="Student ID card"
              hint="Front of your college-issued ID."
              file={idCard}
              inputId="idCard"
              onChange={(e) => setIdCard(e.target.files?.[0] || null)}
              onRemove={() => setIdCard(null)} />
            
              <DocTile
              label="Aadhar card"
              hint="Used only to confirm identity — kept private, never shown publicly."
              file={aadharCard}
              inputId="aadharCard"
              onChange={(e) => setAadharCard(e.target.files?.[0] || null)}
              onRemove={() => setAadharCard(null)} />
            
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
            
              {status === 'loading' && <Loader2Icon className="h-4 w-4 animate-spin" />}
              {status === 'done' && <CheckIcon className="h-4 w-4" />}
              {status === 'idle' ?
            alreadyPending || current?.status === 'rejected' ? 'Resubmit for review' : 'Submit for review' :
            status === 'loading' ? 'Submitting…' : 'Submitted — opening your profile'}
            </button>
          </form>
        }
      </main>

      <Footer />
    </div>);

}