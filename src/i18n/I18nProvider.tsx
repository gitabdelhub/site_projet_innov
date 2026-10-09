import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fr } from './fr';
import { en } from './en';

export type Lang = 'fr' | 'en';
export type MessageKey = keyof typeof fr;

const DICTS: Record<Lang, Record<MessageKey, string>> = { fr, en };
const STORAGE_KEY = 'chesshub-lang';

const detect = (): Lang => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'fr' || saved === 'en') return saved;
  } catch {
    // storage blocked: fall back to the browser language
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
};

// Replace {name} placeholders with values
export const format = (text: string, vars?: Record<string, string | number>) =>
  vars ? text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : text;

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(detect);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // the choice simply won't be remembered
    }
  }, []);

  const t = useCallback((key: MessageKey, vars?: Record<string, string | number>) => format(DICTS[lang][key] ?? key, vars), [lang]);

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
};

// Pick the right language from a bilingual value stored in data files
export type Bilingual = { fr: string; en: string };
export const pick = (value: Bilingual | string, lang: Lang) => (typeof value === 'string' ? value : value[lang]);
