import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

// QD-030 — Proper 404 page. Previously the catch-all just redirected
// to `/`, which is bad UX (a typo'd URL silently shows the homepage
// instead of telling the user "page not found") and bad SEO (no 404
// status code — Google indexes the homepage content under the bad URL).

export function NotFound() {
  return (
    <>
      <Navbar />
      <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-5 py-20 text-center">
        <p className="text-7xl font-bold text-acid">404</p>
        <h1 className="mt-4 text-2xl font-semibold text-chalk">Page not found</h1>
        <p className="mt-2 text-sm text-chalk-muted">
          The page you were looking for doesn't exist or has moved.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-lg bg-acid px-5 py-2.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-acid/90"
        >
          Back to Quad
        </Link>
      </main>
      <Footer />
    </>
  );
}
