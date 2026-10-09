import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { isSupabaseConfigured } from '../lib/supabase';
import { useI18n, type MessageKey } from '../i18n/I18nProvider';
import { AuthForm } from './AuthForm';
import { Icon } from './Icon';

// Pieces shared by the "play together" pages

// Sessions with friends need an account (the server must know who is who)
export const SignInGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useI18n();
  const { user } = useAuth();
  if (!isSupabaseConfigured()) {
    return <Notice icon="globe" text={t('together.needServer')} />;
  }
  if (!user || user.id.startsWith('local-user')) {
    return (
      <div className="max-w-md mx-auto bg-bg-card border border-gray-200/80 rounded-2xl p-6 shadow-sm">
        <p className="text-sm text-text-secondary mb-4 text-center">{t('together.needAccount')}</p>
        <AuthForm />
      </div>
    );
  }
  return <>{children}</>;
};

export const Notice: React.FC<{ icon: 'globe' | 'close' | 'clock' | 'check'; text: string; children?: React.ReactNode }> = ({ icon, text, children }) => (
  <div className="max-w-md mx-auto bg-bg-card border border-gray-200/80 rounded-2xl p-6 shadow-sm text-center">
    <span className="inline-flex w-11 h-11 rounded-xl bg-accent/10 text-accent items-center justify-center mb-3">
      <Icon name={icon} className="w-5 h-5" />
    </span>
    <p className="text-sm text-text-primary">{text}</p>
    {children && <div className="mt-4">{children}</div>}
  </div>
);

export const ErrorText: React.FC<{ error: string | null }> = ({ error }) => {
  const { t } = useI18n();
  if (!error) return null;
  return (
    <p role="alert" className="text-sm text-red-600 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
      {t(error as MessageKey)}
    </p>
  );
};

// The code in big letters and the link, with a copy button
export const ShareBox: React.FC<{ code: string; link: string }> = ({ code, link }) => {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked: the link is still visible and selectable
    }
  };
  return (
    <div className="bg-bg-dark/60 border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="text-center">
        <div className="text-[11px] font-bold uppercase tracking-wide text-text-secondary">{t('together.code')}</div>
        <div className="font-mono text-3xl font-extrabold tracking-[0.25em] text-text-primary">{code}</div>
      </div>
      <div className="flex gap-2">
        <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label={t('together.link')}
          className="flex-1 min-w-0 bg-bg-card border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-text-secondary" />
        <button onClick={copy} className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white font-bold px-3 py-2 rounded-lg text-xs transition-colors">
          <Icon name={copied ? 'check' : 'copy'} className="w-4 h-4" /> {copied ? t('together.copied') : t('together.copy')}
        </button>
      </div>
    </div>
  );
};

export const Spinner: React.FC = () => (
  <span className="inline-block w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin align-middle" />
);
