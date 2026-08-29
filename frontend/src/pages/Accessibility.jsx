import React, { useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

// QD-023 — Public Accessibility Statement. Linked from the footer.

export function Accessibility() {
  useEffect(() => {
    document.title = 'Accessibility — Quad';
  }, []);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-5 py-16 text-chalk">
        <h1 className="mb-2 text-3xl font-bold">Accessibility Statement</h1>
        <p className="mb-8 text-sm text-chalk-muted">Last updated: 2026-08-27</p>

        <p className="mb-4">
          Quad is committed to making our campus marketplace usable by everyone, including
          students with disabilities. This statement describes our current accessibility
          posture, the standards we follow, and how to report issues.
        </p>

        <h2 className="mb-2 mt-8 text-xl font-semibold">1. Standards we target</h2>
        <ul className="mb-4 list-disc space-y-1 pl-6 text-chalk-muted">
          <li>WCAG 2.2 Level AA — our target conformance level.</li>
          <li>WAI-ARIA Authoring Practices for custom widgets.</li>
          <li>Section 508 (US) — relevant for FERPA-protected student data.</li>
          <li>Indian RPwD Act 2016 guidelines.</li>
        </ul>

        <h2 className="mb-2 mt-8 text-xl font-semibold">2. What we do</h2>
        <ul className="mb-4 list-disc space-y-1 pl-6 text-chalk-muted">
          <li>Every interactive element (buttons, links, form fields, dropdowns) has an accessible name via <code>aria-label</code> or visible <code>&lt;label&gt;</code>.</li>
          <li>Upload zones have <code>aria-describedby</code> pointing to a hidden help text that screen readers announce on focus.</li>
          <li>Color contrast meets the WCAG 2.2 AA threshold (4.5:1 for normal text, 3:1 for large text).</li>
          <li>Keyboard-only navigation works for every flow (Tab, Shift+Tab, Enter, Space, Esc).</li>
          <li>Error messages are announced via <code>role="alert"</code> so screen readers pick them up immediately.</li>
          <li>The site respects <code>prefers-reduced-motion</code> — animations are disabled for users who request it.</li>
        </ul>

        <h2 className="mb-2 mt-8 text-xl font-semibold">3. CI a11y gate</h2>
        <p className="mb-4 text-chalk-muted">
          We run <a href="https://github.com/dequelabs/axe-core" className="underline hover:text-chalk" target="_blank" rel="noopener noreferrer">axe-core</a> against every
          built page in CI (see <code>.github/workflows/ci.yml</code>). Any critical or serious axe
          violation fails the build — we don't merge code that regresses accessibility.
        </p>

        <h2 className="mb-2 mt-8 text-xl font-semibold">4. Known limitations</h2>
        <ul className="mb-4 list-disc space-y-1 pl-6 text-chalk-muted">
          <li>The chat UI uses live-updating message lists that don't yet announce new messages to screen readers. We're working on it.</li>
          <li>Real-time Socket.IO updates (notifications, order status changes) currently update the DOM silently — we're adding ARIA live regions.</li>
          <li>Some images uploaded by users may not have descriptive alt text (we use the listing title as a fallback).</li>
        </ul>

        <h2 className="mb-2 mt-8 text-xl font-semibold">5. How to report an a11y issue</h2>
        <p className="mb-4 text-chalk-muted">
          Email <a href="mailto:a11y@quad.app" className="underline hover:text-chalk">a11y@quad.app</a> with:
        </p>
        <ul className="mb-4 list-disc space-y-1 pl-6 text-chalk-muted">
          <li>The page URL where you hit the issue.</li>
          <li>The screen reader / assistive tech you're using (NVDA, JAWS, VoiceOver, etc.).</li>
          <li>What you expected vs. what happened.</li>
        </ul>
        <p className="mb-4 text-chalk-muted">
          We acknowledge within 72 hours and aim to fix within 30 days.
        </p>

        <h2 className="mb-2 mt-8 text-xl font-semibold">6. Plan for full conformance</h2>
        <ul className="mb-4 list-disc space-y-1 pl-6 text-chalk-muted">
          <li>Quarterly third-party audit.</li>
          <li>Continuous axe-core runs in CI.</li>
          <li>Annual review of this statement.</li>
        </ul>
      </main>
      <Footer />
    </>
  );
}
