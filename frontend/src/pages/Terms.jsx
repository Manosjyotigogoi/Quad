import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export function Terms() {
  useEffect(() => {
    document.title = 'Terms of Service — Quad';
  }, []);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-5 py-16 text-chalk">
        <h1 className="mb-2 text-3xl font-bold">Terms of Service</h1>
        <p className="mb-8 text-sm text-chalk-muted">Last updated: 2026-08-27</p>

        {/* QD-021 fix — placeholder notice */}
        <div className="mb-8 rounded-lg border border-yellow-700/40 bg-yellow-900/20 p-4 text-sm text-yellow-200">
          <strong>Note:</strong> The contact email <code>legal@quad.app</code> below is a
          placeholder. Before staging launch, it MUST be replaced with a real inbox.
        </div>

        <p className="mb-4">
          By creating a Quad account, posting a listing, sending a message, or placing an
          order, you agree to these Terms.
        </p>

        <h2 className="mb-2 mt-8 text-xl font-semibold">1. Eligibility</h2>
        <ul className="mb-4 list-disc space-y-1 pl-6 text-chalk-muted">
          <li>At least 18 years old.</li>
          <li>A current student at our campus (verified via .edu email + government ID).</li>
          <li>Legally able to enter into contracts in your jurisdiction.</li>
        </ul>

        <h2 className="mb-2 mt-8 text-xl font-semibold">2. Acceptable use</h2>
        <p className="mb-2 text-chalk-muted">You agree NOT to:</p>
        <ul className="mb-4 list-disc space-y-1 pl-6 text-chalk-muted">
          <li>Post illegal, counterfeit, stolen, or weapon-related listings.</li>
          <li>Post listings for items you do not own or cannot deliver.</li>
          <li>Use Quad to harass, threaten, or scam other users.</li>
          <li>Attempt to circumvent the verification system.</li>
          <li>Reverse-engineer, scrape, or overload Quad's servers.</li>
          <li>Use another user's photos without permission.</li>
        </ul>

        <h2 className="mb-2 mt-8 text-xl font-semibold">3. Transactions</h2>
        <ul className="mb-4 list-disc space-y-1 pl-6 text-chalk-muted">
          <li>Quad is a platform, not a party to your transactions.</li>
          <li>We do not process payments, hold escrow, or guarantee delivery.</li>
          <li>All transactions are between the buyer and the seller.</li>
          <li>Sellers are responsible for delivering as described.</li>
          <li>Buyers are responsible for inspecting the item before completing.</li>
        </ul>

        <h2 className="mb-2 mt-8 text-xl font-semibold">4. Prohibited items</h2>
        <ul className="mb-4 list-disc space-y-1 pl-6 text-chalk-muted">
          <li>Alcohol, tobacco, drugs, drug paraphernalia.</li>
          <li>Weapons, fireworks, explosives.</li>
          <li>Counterfeit or stolen goods.</li>
          <li>Academic work for the purpose of dishonesty.</li>
          <li>Anything illegal under Indian / campus law.</li>
        </ul>

        <h2 className="mb-2 mt-8 text-xl font-semibold">5. Takedowns / abuse reports</h2>
        <p className="mb-4 text-chalk-muted">
          See our <Link to="/takedown" className="underline hover:text-chalk">Abuse / Takedown Process</Link>.
          We acknowledge all reports within 72 hours.
        </p>

        <h2 className="mb-2 mt-8 text-xl font-semibold">6. Disclaimer & limitation of liability</h2>
        <p className="mb-4 text-chalk-muted">
          Quad is provided "as is". We make no warranties about the safety, legality, or
          quality of items posted by users. Our total liability is limited to INR 100.
        </p>

        <h2 className="mb-2 mt-8 text-xl font-semibold">7. Contact</h2>
        <p className="mb-4 text-chalk-muted">
          Email legal@quad.app. See also our{' '}
          <Link to="/privacy" className="underline hover:text-chalk">Privacy Policy</Link>.
        </p>

        <p className="mt-12 text-xs text-chalk-dim">
          Full source for these terms is at docs/TERMS_OF_SERVICE.md in the project repo.
        </p>
      </main>
      <Footer />
    </>
  );
}
