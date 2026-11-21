import { useState, type FormEvent } from 'react';
import { Loader2, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../../online/auth';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n/messages';

const USERNAME_RE = /^[A-Za-z0-9_-]{3,20}$/;

const errorKey = (message: string): MessageKey => {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'auth.badCredentials';
  if (m.includes('not confirmed')) return 'auth.emailNotConfirmed';
  if (m.includes('already registered') || m.includes('already exists')) return 'auth.userExists';
  if (m.includes('password')) return 'auth.weakPassword';
  if (m.includes('rate limit') || m.includes('too many')) return 'auth.rateLimit';
  return 'auth.genericError';
};

const inputCls =
  'w-full bg-bg-dark text-text-primary rounded-xl px-4 py-3 border border-gray-200 focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none';

export const AuthCard = ({ onDone, compact = false }: { onDone?: () => void; compact?: boolean }) => {
  const { t } = useI18n();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (mode === 'up' && !USERNAME_RE.test(username.trim())) {
      setError(t('profile.badUsername'));
      return;
    }
    setBusy(true);
    try {
      if (mode === 'up') {
        const { data: taken } = await supabase
          .from('profiles')
          .select('id')
          .ilike('username', username.trim().replace(/[\\%_]/g, '\\$&'))
          .maybeSingle();
        if (taken) {
          setError(t('profile.taken'));
          return;
        }
        const { needsConfirmation } = await signUp(email.trim(), password, username.trim());
        if (needsConfirmation) {
          setInfo(t('auth.checkEmail'));
          setMode('in');
          return;
        }
      } else {
        await signIn(email.trim(), password);
      }
      onDone?.();
    } catch (err) {
      setError(t(errorKey(err instanceof Error ? err.message : '')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`bg-bg-card border border-gray-200/80 rounded-2xl shadow-sm ${compact ? 'p-5' : 'p-6 sm:p-8'} w-full max-w-md`}>
      <div className="grid grid-cols-2 gap-1 p-1 bg-bg-darker rounded-xl mb-5" role="tablist">
        {(['in', 'up'] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`py-2 rounded-lg text-sm font-bold transition-colors ${
              mode === m ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {m === 'in' ? t('auth.signIn') : t('auth.signUp')}
          </button>
        ))}
      </div>
      <h2 className="text-xl font-black text-text-primary">{mode === 'in' ? t('auth.signInTitle') : t('auth.signUpTitle')}</h2>
      <p className="text-sm text-text-secondary mb-5">{t('auth.subtitle')}</p>

      <form onSubmit={submit} className="space-y-3">
        {mode === 'up' && (
          <label className="block">
            <span className="block text-xs font-bold text-text-secondary mb-1">{t('auth.username')}</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputCls}
              autoComplete="username"
              maxLength={20}
              required
            />
            <span className="block text-[11px] text-text-secondary mt-1">{t('auth.usernameHint')}</span>
          </label>
        )}
        <label className="block">
          <span className="block text-xs font-bold text-text-secondary mb-1">{t('auth.email')}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            autoComplete="email"
            required
          />
        </label>
        <label className="block">
          <span className="block text-xs font-bold text-text-secondary mb-1">{t('auth.password')}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            minLength={6}
            required
          />
          {mode === 'up' && <span className="block text-[11px] text-text-secondary mt-1">{t('auth.passwordHint')}</span>}
        </label>

        {error && <p className="text-sm text-danger bg-red-50 rounded-xl px-3 py-2">{error}</p>}
        {info && <p className="text-sm text-emerald-800 bg-emerald-50 rounded-xl px-3 py-2">{info}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-bold py-3 rounded-xl shadow-sm shadow-accent/25 transition-colors"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : mode === 'in' ? <LogIn size={18} /> : <UserPlus size={18} />}
          {mode === 'in' ? t('auth.submitIn') : t('auth.submitUp')}
        </button>
      </form>

      <p className="text-sm text-text-secondary mt-4 text-center">
        {mode === 'in' ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
        <button
          onClick={() => {
            setMode(mode === 'in' ? 'up' : 'in');
            setError(null);
          }}
          className="text-accent hover:text-accent-hover font-bold"
        >
          {mode === 'in' ? t('auth.signUp') : t('auth.signIn')}
        </button>
      </p>
    </div>
  );
};
