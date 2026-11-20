/**
 * Online accounts (Supabase Auth). One shared state for the whole site.
 * The public profile (username, rating, results) lives in the `profiles` table;
 * the email stays private in Supabase Auth.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { User } from '../types/auth';

interface AuthCtx {
  user: User | null;
  /** True until the first session check is done. */
  loading: boolean;
  error: string | null;
  signUp: (email: string, password: string, username: string) => Promise<{ needsConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

const loadProfile = async (session: Session | null): Promise<User | null> => {
  if (!session?.user) return null;
  // The profile is created by a trigger when the account is created: retry briefly.
  for (let i = 0; i < 4; i++) {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, elo_rating, games_played, wins, losses, draws')
      .eq('id', session.user.id)
      .maybeSingle();
    if (data) return { ...(data as Omit<User, 'email'>), email: session.user.email ?? '' };
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    let alive = true;
    const apply = async (session: Session | null) => {
      const u = await loadProfile(session).catch(() => null);
      if (alive) {
        setUser(u);
        setLoading(false);
      }
    };
    supabase.auth
      .getSession()
      .then(({ data }) => apply(data.session))
      .catch(() => alive && setLoading(false));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // Supabase advises not to await other calls inside this callback.
        setTimeout(() => apply(session), 0);
      }
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [configured]);

  const signUp = useCallback(async (email: string, password: string, username: string) => {
    setError(null);
    const { data, error: e } = await supabase.auth.signUp({ email, password, options: { data: { username } } });
    if (e) {
      setError(e.message);
      throw e;
    }
    return { needsConfirmation: !data.session };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    const { error: e } = await supabase.auth.signInWithPassword({ email, password });
    if (e) {
      setError(e.message);
      throw e;
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const u = await loadProfile(data.session).catch(() => null);
    setUser(u);
  }, []);

  const value = useMemo(
    () => ({ user, loading, error, signUp, signIn, signOut, refreshProfile }),
    [user, loading, error, signUp, signIn, signOut, refreshProfile],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useAuth = (): AuthCtx => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
