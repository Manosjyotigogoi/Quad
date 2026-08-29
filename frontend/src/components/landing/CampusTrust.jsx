import React from 'react';
import { GraduationCapIcon, MessagesSquareIcon, WalletIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Titles/bodies are i18n keys, resolved at render time.
const pointDefs = [
  {
    icon: GraduationCapIcon,
    titleKey: 'campusTrust.eduOnly',
    bodyKey: 'campusTrust.eduOnlyBody'
  },
  {
    icon: MessagesSquareIcon,
    titleKey: 'campusTrust.publicPickup',
    bodyKey: 'campusTrust.publicPickupBody'
  },
  {
    icon: WalletIcon,
    titleKey: 'campusTrust.zeroFees',
    bodyKey: 'campusTrust.zeroFeesBody'
  }
];

export function CampusTrust() {
  const { t } = useTranslation();

  return (
    <section className="border-b border-ink-700/70">
      <div className="mx-auto grid w-full max-w-[1240px] gap-12 px-5 py-20 lg:grid-cols-[0.8fr_1.2fr] lg:px-8 lg:py-24">
        <h2 className="text-3xl font-extrabold tracking-[-0.02em] text-chalk sm:text-[40px]">
          {t('campusTrust.title')}
        </h2>

        <ul className="divide-y divide-ink-700/80">
          {pointDefs.map((point) => (
            <li key={point.titleKey} className="flex gap-5 py-6 first:pt-0 last:pb-0">
              <point.icon className="mt-0.5 h-5 w-5 shrink-0 text-acid" />
              <div>
                <h3 className="text-base font-semibold text-chalk">
                  {t(point.titleKey)}
                </h3>
                <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-chalk-muted">
                  {t(point.bodyKey)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
