import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import hi from './hi.json';

// Two languages for now — the framework is in place so you can add more
// (es, fr, etc.) by dropping a new JSON file and registering it below.
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi }
  },
  lng: (typeof window !== 'undefined' && window.localStorage.getItem('quad_lang')) || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
});

export default i18n;
