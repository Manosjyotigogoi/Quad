import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

// Step titles/bodies are i18n keys, resolved at render time.
const stepKeys = [
  { step: '1', titleKey: 'sellFlow.step1', bodyKey: 'sellFlow.step1Body' },
  { step: '2', titleKey: 'sellFlow.step2', bodyKey: 'sellFlow.step2Body' },
  { step: '3', titleKey: 'sellFlow.step3', bodyKey: 'sellFlow.step3Body' }
];

export function SellFlow() {
  const { user } = useAuth();
  const { t } = useTranslation();

  return (
    <section id="sell" className="scroll-mt-20 border-b border-ink-700/70">
      <div className="mx-auto w-full max-w-[1240px] px-5 py-20 lg:px-8 lg:py-24">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-extrabold tracking-[-0.02em] text-chalk sm:text-[40px]">
            {t('sellFlow.title')}
          </h2>
          <p className="mt-3 text-[15px] text-chalk-muted">
            {t('sellFlow.subtitle')}
          </p>
        </div>

        <ol className="mt-12 grid gap-px overflow-hidden rounded-card border border-ink-700 bg-ink-700 md:grid-cols-3">
          {stepKeys.map((item) => (
            <li key={item.step} className="flex flex-col bg-ink-900 p-7">
              <span className="text-sm font-bold text-acid">{item.step}</span>
              <h3 className="mt-4 text-xl font-bold tracking-tight text-chalk">
                {t(item.titleKey)}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-chalk-muted">
                {t(item.bodyKey)}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Link
            to={user ? '/listings/new' : '/signup'}
            className="inline-flex items-center gap-1.5 rounded-full bg-acid px-6 py-3 text-[15px] font-semibold text-ink-950 transition-transform duration-150 ease-smooth hover:scale-[1.02]"
          >
            {t('sellFlow.cta')}
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <p className="text-sm text-chalk-muted">
            {t('sellFlow.feesNote')}
          </p>
        </div>
      </div>
    </section>
  );
}
