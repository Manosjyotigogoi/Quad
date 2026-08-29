import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

// QD-021 — Static legal pages. We render the markdown content
// statically (not via a markdown parser, to keep the bundle small and
// avoid runtime XSS risk). When the policy changes, update both this
// file and docs/PRIVACY_POLICY.md together.

export function Privacy() {
  useEffect(() => {
    document.title = 'Privacy Policy — Quad';
  }, []);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-5 py-16 text-chalk">
        <h1 className="mb-2 text-3xl font-bold">Privacy Policy</h1>
        <p className="mb-8 text-sm text-chalk-muted">Last updated: 2026-08-27</p>

        {/* QD-021 fix — be explicit about placeholder contact info */}
        <div className="mb-8 rounded-lg border border-yellow-700/40 bg-yellow-900/20 p-4 text-sm text-yellow-200">
          <strong>Note:</strong> The contact emails below (privacy@quad.app,
          legal@quad.app, abuse@quad.app) are placeholders. Before the staging
          launch, they MUST be replaced with real inboxes wired to the
          <code className="mx-1 bg-black/30 px-1 rounded">ADMIN_EMAIL</code>
          env var. Until then, please report issues via your campus student
          help desk.
        </div>

        <p className="mb-4">
          Quad is a single-campus student marketplace. We collect government-issued ID
          photos (student ID, Aadhar card) for verification. This policy explains what
          we collect, why, how long we keep it, and your rights.
        </p>

        <h2 className="mb-2 mt-8 text-xl font-semibold">1. Who we are</h2>
        <p className="mb-4 text-chalk-muted">
          Quad is operated by students at the campus whose <code>.edu</code> email
          domain is configured as <code>COLLEGE_EMAIL_DOMAIN</code>. To contact us
          about privacy issues, email{' '}
          <a href="mailto:privacy@quad.app" className="underline hover:text-chalk">privacy@quad.app</a>{' '}
          (placeholder — see note above).
        </p>

        <h2 className="mb-2 mt-8 text-xl font-semibold">2. What we collect</h2>
        <ul className="mb-4 list-disc space-y-1 pl-6 text-chalk-muted">
          <li>Account: name, college email, phone, password (bcrypt-hashed).</li>
          <li>Profile: avatar, major, dorm, bio.</li>
          <li>Listings: title, price, photos, pickup spot.</li>
          <li>Messages: conversation text between buyers and sellers.</li>
          <li>Verification docs: student ID photo, Aadhar card photo, registration no.</li>
          <li>Device / session: JWT cookie (httpOnly), user-agent, IP (audit log only).</li>
        </ul>

        <h2 className="mb-2 mt-8 text-xl font-semibold">3. Why we collect verification documents</h2>
        <p className="mb-4 text-chalk-muted">
          To verify that you are a genuine student at our campus before you can post listings,
          send messages, or transact. Documents are stored in private Cloudinary assets
          accessible only via short-lived signed URLs, viewable only by admin users while
          the verification is pending. Documents are deleted within 30 days of the decision
          unless you request earlier deletion.
        </p>

        {/* QD-021 fix — added the dropped "Legal bases" section (GDPR Art. 6) */}
        <h2 className="mb-2 mt-8 text-xl font-semibold">4. Legal bases (GDPR Art. 6)</h2>
        <p className="mb-2 text-chalk-muted">We process your personal data on:</p>
        <ul className="mb-4 list-disc space-y-1 pl-6 text-chalk-muted">
          <li><strong>Performance of a contract</strong> (Art. 6(1)(b)) — creating an account so you can post listings and transact.</li>
          <li><strong>Legitimate interest</strong> (Art. 6(1)(f)) — preventing fraud by verifying student status.</li>
          <li><strong>Legal obligation</strong> (Art. 6(1)(c)) — keeping audit-log records for fraud-prevention compliance.</li>
        </ul>

        {/* QD-021 fix — added the dropped "Who we share data with" section */}
        <h2 className="mb-2 mt-8 text-xl font-semibold">5. Who we share data with</h2>
        <p className="mb-2 text-chalk-muted">We do <strong>not</strong> sell your data. We share it only with:</p>
        <ul className="mb-4 list-disc space-y-1 pl-6 text-chalk-muted">
          <li><strong>Cloudinary</strong> — image hosting for listing photos and verification documents.</li>
          <li><strong>MongoDB Atlas</strong> — database hosting for all structured data.</li>
          <li><strong>Your SMTP provider</strong> (SES / Mailgun / etc.) — for transactional emails (OTP codes, order updates, password resets).</li>
          <li><strong>Law enforcement</strong> — only if compelled by a valid legal request (court order, etc.).</li>
        </ul>

        <h2 className="mb-2 mt-8 text-xl font-semibold">6. Your rights (GDPR / DPDP / CCPA)</h2>
        <ul className="mb-4 list-disc space-y-1 pl-6 text-chalk-muted">
          <li>Access — request a copy of all your personal data.</li>
          <li>Rectify — correct inaccurate data.</li>
          <li>Erase — request deletion of your account.</li>
          <li>Portability — receive your data in JSON.</li>
          <li>Object — to processing based on legitimate interest.</li>
        </ul>
        <p className="mb-4 text-chalk-muted">
          To exercise any of these rights, email{' '}
          <a href="mailto:privacy@quad.app" className="underline hover:text-chalk">privacy@quad.app</a>{' '}
          (placeholder — see note above). We respond within 30 days.
        </p>

        <h2 className="mb-2 mt-8 text-xl font-semibold">7. Security</h2>
        <ul className="mb-4 list-disc space-y-1 pl-6 text-chalk-muted">
          <li>Passwords stored as bcrypt hashes (cost 10).</li>
          <li>HTTPS-only in production (HSTS enabled).</li>
          <li>Auth cookies are httpOnly + Secure + SameSite=None.</li>
          <li>Verification docs in private Cloudinary assets via signed URLs.</li>
          <li>Admin actions recorded in an append-only audit log.</li>
          <li>Quarterly backup / restore drill.</li>
        </ul>

        <h2 className="mb-2 mt-8 text-xl font-semibold">8. Retention</h2>
        <ul className="mb-4 list-disc space-y-1 pl-6 text-chalk-muted">
          <li>Account: until you request deletion.</li>
          <li>Listings / Messages: until you delete + 30 days.</li>
          <li>Verification docs: 30 days after decision (or earlier on request).</li>
          <li>Audit logs: 2 years.</li>
          <li>Server logs: 30 days.</li>
        </ul>

        {/* QD-021 fix — added the dropped "International transfers" section */}
        <h2 className="mb-2 mt-8 text-xl font-semibold">9. International transfers</h2>
        <p className="mb-4 text-chalk-muted">
          Your data may be processed outside your home country (Cloudinary and MongoDB
          Atlas may store backups in different regions). We rely on Standard Contractual
          Clauses (SCCs) for any such transfer.
        </p>

        <h2 className="mb-2 mt-8 text-xl font-semibold">10. Children</h2>
        <p className="mb-4 text-chalk-muted">
          Quad is for adult students at our campus only. We do not knowingly collect data
          from anyone under 18. If you believe we have collected data from a minor, contact{' '}
          <a href="mailto:privacy@quad.app" className="underline hover:text-chalk">privacy@quad.app</a>{' '}
          and we will delete it.
        </p>

        <h2 className="mb-2 mt-8 text-xl font-semibold">11. Changes to this policy</h2>
        <p className="mb-4 text-chalk-muted">
          We will email all users 30 days before any material change takes effect. The
          current version is always at <code>/privacy</code>.
        </p>

        <h2 className="mb-2 mt-8 text-xl font-semibold">12. Contact</h2>
        <p className="mb-4 text-chalk-muted">
          Email{' '}
          <a href="mailto:privacy@quad.app" className="underline hover:text-chalk">privacy@quad.app</a>{' '}
          (placeholder — see note above). See also our{' '}
          <Link to="/terms" className="underline hover:text-chalk">Terms of Service</Link> and{' '}
          <Link to="/takedown" className="underline hover:text-chalk">Takedown Process</Link>.
        </p>

        <p className="mt-12 text-xs text-chalk-dim">
          Full source for this policy is at docs/PRIVACY_POLICY.md in the project repo.
        </p>
      </main>
      <Footer />
    </>
  );
}
