import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export function Takedown() {
  useEffect(() => {
    document.title = 'Abuse / Takedown Process — Quad';
  }, []);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-5 py-16 text-chalk">
        <h1 className="mb-2 text-3xl font-bold">Abuse / Takedown Process</h1>
        <p className="mb-8 text-sm text-chalk-muted">Last updated: 2026-08-27</p>

        {/* QD-021 fix — placeholder notice */}
        <div className="mb-8 rounded-lg border border-yellow-700/40 bg-yellow-900/20 p-4 text-sm text-yellow-200">
          <strong>Note:</strong> The contact email <code>abuse@quad.app</code> below is a
          placeholder. Before staging launch, it MUST be replaced with a real inbox that
          receives reports within the 72-hour SLA promised below.
        </div>

        <p className="mb-4">
          Quad is a student marketplace. We take reports of abuse, fraud, and illegal
          content seriously. Here is how to report abuse and what we do about it.
        </p>

        <h2 className="mb-2 mt-8 text-xl font-semibold">1. How to report</h2>
        <ul className="mb-4 list-disc space-y-1 pl-6 text-chalk-muted">
          <li><strong>In-app:</strong> Use the Report button on any listing detail page.</li>
          <li><strong>Email:</strong> abuse@quad.app with the listing URL / ID and the reason.</li>
          <li><strong>Emergency:</strong> Contact local emergency services first, then notify us.</li>
        </ul>

        <h2 className="mb-2 mt-8 text-xl font-semibold">2. Response time</h2>
        <p className="mb-4 text-chalk-muted">
          We acknowledge all reports within 72 hours and aim to resolve within 7 days.
        </p>

        <h2 className="mb-2 mt-8 text-xl font-semibold">3. What we do</h2>
        <ul className="mb-4 list-disc space-y-1 pl-6 text-chalk-muted">
          <li>Remove the offending listing.</li>
          <li>Suspend or permanently ban the offending user.</li>
          <li>Revoke verification status.</li>
          <li>Report to law enforcement when required by law.</li>
        </ul>

        <h2 className="mb-2 mt-8 text-xl font-semibold">4. Counter-notice</h2>
        <p className="mb-4 text-chalk-muted">
          If your listing was taken down and you believe it was in error, email
          abuse@quad.app within 14 days. We will review and either reinstate or uphold the
          takedown with a written explanation.
        </p>

        <h2 className="mb-2 mt-8 text-xl font-semibold">5. Privacy</h2>
        <p className="mb-4 text-chalk-muted">
          Reports are handled confidentially. The reported user is not told who reported them.
          See our <Link to="/privacy" className="underline hover:text-chalk">Privacy Policy</Link>.
        </p>

        <h2 className="mb-2 mt-8 text-xl font-semibold">6. Contact</h2>
        <p className="mb-4 text-chalk-muted">Email abuse@quad.app.</p>

        <p className="mt-12 text-xs text-chalk-dim">
          Full source for this process is at docs/TAKEDOWN_PROCESS.md in the project repo.
        </p>
      </main>
      <Footer />
    </>
  );
}
