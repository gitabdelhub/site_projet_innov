import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { messages, type Lang, type MessageKey } from './messages';
import { safeGetRaw, safeSet } from '../lib/storage';

const LANG_KEY = 'chesshub.lang';

const detectLang = (): Lang => {
  const saved = safeGetRaw(LANG_KEY);
  if (saved === 'fr' || saved === 'en') return saved;
  // Default audience is Morocco / francophone Africa: French unless the browser is clearly English.
  const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'fr';
  return nav.startsWith('en') ? 'en' : 'fr';
};

type Vars = Record<string, string | number>;

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: MessageKey, vars?: Vars) => string;
}

const Ctx = createContext<I18n | null>(null);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(detectLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    safeSet(LANG_KEY, l);
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: Vars) => {
      let s: string = messages[lang][key] ?? messages.fr[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
      return s;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useI18n = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
};
