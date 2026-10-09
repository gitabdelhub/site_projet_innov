import React, { createContext, useCallback, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { User, AuthState } from '../types/auth';

export interface AuthContextValue extends AuthState {
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const toUser = (profile: any): User => ({
  id: profile.id,
  email: profile.email,
  username: profile.username,
  elo_rating: profile.elo_rating ?? 1200,
  games_played: profile.games_played ?? 0,
  wins: profile.wins ?? 0,
  losses: profile.losses ?? 0,
  draws: profile.draws ?? 0,
});

const createLocalUser = (email: string, username: string): User => ({
  id: 'local-user-' + Date.now(),
  email,
  username,
  elo_rating: 1200,
  games_played: 0,
  wins: 0,
  losses: 0,
  draws: 0,
});

// Single source of truth for the signed-in user, shared by every component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({ user: null, loading: true, error: null });
  const configured = isSupabaseConfigured();

  const loadProfile = useCallback(async (userId: string, email = '') => {
    // The profile row is created by a database trigger right after sign-up: retry briefly.
    // E-mail addresses are private (migration v3): ours comes from the session.
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, elo_rating, games_played, wins, losses, draws')
        .eq('id', userId)
        .maybeSingle();
      if (profile) return toUser({ ...profile, email });
      await new Promise((r) => setTimeout(r, 700));
    }
    return null;
  }, []);

  useEffect(() => {
    if (!configured) {
      try {
        const stored = localStorage.getItem('localUser');
        setAuthState({ user: stored ? (JSON.parse(stored) as User) : null, loading: false, error: null });
      } catch {
        setAuthState({ user: null, loading: false, error: null });
      }
      return;
    }

    let active = true;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const user = session?.user ? await loadProfile(session.user.id, session.user.email) : null;
      if (active) setAuthState({ user, loading: false, error: null });
    }).catch((error) => {
      if (active) setAuthState({ user: null, loading: false, error: error.message });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const user = await loadProfile(session.user.id, session.user.email);
        if (active) setAuthState({ user, loading: false, error: null });
      } else if (event === 'SIGNED_OUT') {
        setAuthState({ user: null, loading: false, error: null });
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [configured, loadProfile]);

  const signUp = async (email: string, password: string, username: string) => {
    setAuthState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      if (!configured) {
        const user = createLocalUser(email, username);
        localStorage.setItem('localUser', JSON.stringify(user));
        setAuthState({ user, loading: false, error: null });
        return;
      }
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username } } });
      if (error) throw error;
      if (!data.user) throw new Error('Sign up failed');
      // Without a session, Supabase is waiting for the user to confirm their email
      setAuthState((prev) => ({
        ...prev,
        loading: false,
        error: data.session ? null : 'Check your inbox to confirm your email, then sign in.',
      }));
    } catch (error: any) {
      setAuthState((prev) => ({ ...prev, loading: false, error: error.message || 'Failed to sign up' }));
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    setAuthState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      if (!configured) {
        const stored = localStorage.getItem('localUser');
        const existing = stored ? (JSON.parse(stored) as User) : null;
        const user = existing && existing.email === email ? existing : createLocalUser(email, email.split('@')[0]);
        localStorage.setItem('localUser', JSON.stringify(user));
        setAuthState({ user, loading: false, error: null });
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error: any) {
      setAuthState((prev) => ({ ...prev, loading: false, error: error.message || 'Failed to sign in' }));
      throw error;
    }
  };

  const signOut = async () => {
    setAuthState((prev) => ({ ...prev, loading: true }));
    try {
      if (!configured) {
        localStorage.removeItem('localUser');
        setAuthState({ user: null, loading: false, error: null });
        return;
      }
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error: any) {
      setAuthState((prev) => ({ ...prev, loading: false, error: error.message || 'Failed to sign out' }));
    }
  };

  // Reload rating and stats, e.g. after an online game
  const refreshProfile = useCallback(async () => {
    const id = authState.user?.id;
    if (!configured || !id) return;
    const user = await loadProfile(id, authState.user?.email);
    if (user) setAuthState((prev) => ({ ...prev, user }));
  }, [configured, authState.user?.id, authState.user?.email, loadProfile]);

  return (
    <AuthContext.Provider value={{ ...authState, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
