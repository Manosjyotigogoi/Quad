import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Logo } from './Logo';

// Column headings/link labels are i18n keys — resolved at render time so
// the footer flips languages together with the rest of the app.
const columnDefs = [
  {
    headingKey: 'footer.marketplace',
    linkKeys: [
      'footer.links.textbooks',
      'footer.links.dorm',
      'footer.links.tech',
      'footer.links.freeStuff'
    ]
  },
  {
    headingKey: 'footer.selling',
    linkKeys: [
      'footer.links.postItem',
      'footer.links.pricing',
      'footer.links.pickupSpots',
      'footer.links.sellerRules'
    ]
  },
  {
    headingKey: 'footer.campus',
    linkKeys: [
      'footer.links.verifyEdu',
      'footer.links.safety',
      'footer.links.reportListing',
      'footer.links.helpCenter'
    ]
  }
];

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-ink-700/70 bg-ink-950">
      <div className="mx-auto w-full max-w-[1240px] px-5 py-14 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-chalk-muted">
              {t('footer.tagline')}
            </p>
          </div>
          {columnDefs.map((col) => (
            <div key={col.headingKey}>
              <h3 className="text-sm font-semibold text-chalk">{t(col.headingKey)}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.linkKeys.map((linkKey) => (
                  <li key={linkKey}>
                    <Link
                      to="/#feed"
                      className="text-sm text-chalk-muted transition-colors duration-150 ease-smooth hover:text-chalk"
                    >
                      {t(linkKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-ink-700/70 pt-6 text-sm text-chalk-dim sm:flex-row sm:items-center sm:justify-between">
          <p>{t('footer.rights')}</p>
          <div className="flex gap-6">
            {/* QD-021 — Legal pages must be reachable from every page's footer. */}
            <Link
              to="/terms"
              className="transition-colors duration-150 ease-smooth hover:text-chalk"
            >
              {t('footer.terms')}
            </Link>
            <Link
              to="/privacy"
              className="transition-colors duration-150 ease-smooth hover:text-chalk"
            >
              {t('footer.privacy')}
            </Link>
            <Link
              to="/takedown"
              className="transition-colors duration-150 ease-smooth hover:text-chalk"
            >
              Takedown
            </Link>
            {/* QD-023 — Accessibility statement */}
            <Link
              to="/accessibility"
              className="transition-colors duration-150 ease-smooth hover:text-chalk"
            >
              Accessibility
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
