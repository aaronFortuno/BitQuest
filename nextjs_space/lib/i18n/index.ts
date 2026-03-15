'use client';

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ca from './ca.json';
import es from './es.json';
import en from './en.json';

const resources = {
  ca: { translation: ca },
  es: { translation: es },
  en: { translation: en },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'ca',
    fallbackLng: 'ca',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;

export const languages = [
  { code: 'ca', name: 'Català', flag: '🇦🇩', shortCode: 'CA' },
  { code: 'es', name: 'Español', flag: '🇪🇸', shortCode: 'ES' },
  { code: 'en', name: 'English', flag: '🇺🇸', shortCode: 'EN' },
];

export function changeLanguage(lang: string) {
  i18n.changeLanguage(lang);
}
