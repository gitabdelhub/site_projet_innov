import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useI18n, type MessageKey } from '../i18n/I18nProvider';

// Supabase answers in English: show the common cases in the reader's language
const KNOWN_ERRORS: [RegExp, MessageKey][] = [
  [/invalid login credentials/i, 'auth.errInvalid'],
  [/already registered|already exists/i, 'auth.errTaken'],
  [/at least 6 characters|password should/i, 'auth.errPassword'],
  [/confirm your email|email not confirmed/i, 'auth.errConfirm'],
  [/rate limit|too many/i, 'auth.errRate'],
  [/invalid.*email|email.*invalid/i, 'auth.errEmail'],
];

interface AuthFormProps {
  onDone?: () => void;
  initialMode?: 'signIn' | 'signUp';
}

export const AuthForm: React.FC<AuthFormProps> = ({ onDone, initialMode = 'signIn' }) => {
  const { t } = useI18n();
  const [isSignUp, setIsSignUp] = useState(initialMode === 'signUp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const { signUp, signIn, loading, error } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isSignUp) await signUp(email, password, username);
      else await signIn(email, password);
      onDone?.();
    } catch {
      // the message is shown below from the auth state
    }
  };

  const known = error ? KNOWN_ERRORS.find(([re]) => re.test(error)) : undefined;
  const message = error ? (known ? t(known[1]) : error) : null;
  const field = 'w-full bg-bg-dark text-text-primary rounded-xl px-4 py-3 border border-gray-200 focus:border-accent focus:outline-none text-sm';

  return (
    <div>
      <h2 className="text-2xl font-extrabold text-text-primary mb-1">{t(isSignUp ? 'auth.createTitle' : 'auth.signInTitle')}</h2>
      <p className="text-sm text-text-secondary mb-6">{t(isSignUp ? 'auth.createText' : 'auth.signInText')}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignUp && (
          <label className="block">
            <span className="block text-text-secondary text-xs font-bold mb-1.5">{t('auth.username')}</span>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className={field} required minLength={3} maxLength={24} autoComplete="username" />
            <span className="block text-[11px] text-text-secondary mt-1">{t('auth.usernameHint')}</span>
          </label>
        )}
        <label className="block">
          <span className="block text-text-secondary text-xs font-bold mb-1.5">{t('auth.email')}</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} required autoComplete="email" />
        </label>
        <label className="block">
          <span className="block text-text-secondary text-xs font-bold mb-1.5">{t('auth.password')}</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} required minLength={6} autoComplete={isSignUp ? 'new-password' : 'current-password'} />
        </label>

        {message && <p role="alert" className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">{message}</p>}

        <button type="submit" disabled={loading} className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50">
          {loading ? t('common.loading') : t(isSignUp ? 'auth.signUp' : 'auth.signIn')}
        </button>
      </form>

      <p className="mt-5 text-center text-text-secondary text-sm">
        {t(isSignUp ? 'auth.haveAccount' : 'auth.noAccount')}{' '}
        <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-accent hover:underline font-bold">
          {t(isSignUp ? 'auth.signIn' : 'auth.signUp')}
        </button>
      </p>
      <p className="mt-3 text-center text-[11px] text-text-secondary">{t('auth.privacy')}</p>
    </div>
  );
};
