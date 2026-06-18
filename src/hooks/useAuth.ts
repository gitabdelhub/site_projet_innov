import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { User, AuthState } from '../types/auth';

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  const configured = isSupabaseConfigured();

  // Load and listen to auth state
  useEffect(() => {
    if (!configured) {
      // Offline/Guest Local Mode initial load
      const storedUser = localStorage.getItem('localUser');
      if (storedUser) {
        try {
          setAuthState({
            user: JSON.parse(storedUser) as User,
            loading: false,
            error: null,
          });
        } catch (error) {
          console.error('Error parsing stored user:', error);
          setAuthState({ user: null, loading: false, error: null });
        }
      } else {
        setAuthState({ user: null, loading: false, error: null });
      }
      return;
    }

    // Supabase Mode
    const getSessionAndProfile = async () => {
      try {
        setAuthState(prev => ({ ...prev, loading: true }));
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // Fetch user profile from profiles table
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profile) {
            setAuthState({
              user: {
                id: profile.id,
                email: profile.email,
                username: profile.username,
                elo_rating: profile.elo_rating ?? 1200,
                games_played: profile.games_played ?? 0,
                wins: profile.wins ?? 0,
                losses: profile.losses ?? 0,
                draws: profile.draws ?? 0,
              },
              loading: false,
              error: null,
            });
            return;
          }
        }
        setAuthState({ user: null, loading: false, error: null });
      } catch (error: any) {
        console.error('Error fetching session/profile:', error);
        setAuthState({ user: null, loading: false, error: error.message });
      }
    };

    getSessionAndProfile();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Fetch profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          setAuthState({
            user: {
              id: profile.id,
              email: profile.email,
              username: profile.username,
              elo_rating: profile.elo_rating ?? 1200,
              games_played: profile.games_played ?? 0,
              wins: profile.wins ?? 0,
              losses: profile.losses ?? 0,
              draws: profile.draws ?? 0,
            },
            loading: false,
            error: null,
          });
        }
      } else if (event === 'SIGNED_OUT') {
        setAuthState({ user: null, loading: false, error: null });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [configured]);

  const signUp = async (email: string, password: string, username: string) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    try {
      if (!configured) {
        // Guest mode simulation
        const mockUser: User = {
          id: 'local-user-' + Date.now(),
          email,
          username,
          elo_rating: 1200,
          games_played: 0,
          wins: 0,
          losses: 0,
          draws: 0,
        };
        setAuthState({
          user: mockUser,
          loading: false,
          error: null,
        });
        localStorage.setItem('localUser', JSON.stringify(mockUser));
        return;
      }

      // Real Supabase Sign Up
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
        },
      });

      if (error) throw error;
      if (!data.user) throw new Error('Sign up failed');

      // Note: Trigger in Supabase setup automatically populates public.profiles on auth user insert.
      // We will wait a brief moment for the trigger or fetch it.
      // In many cases, Supabase requires email confirmation first. If confirmation is off, the session is active.
      
    } catch (error: any) {
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to sign up',
      }));
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    try {
      if (!configured) {
        // Guest mode simulation check local storage
        const storedUser = localStorage.getItem('localUser');
        if (storedUser) {
          const user = JSON.parse(storedUser) as User;
          if (user.email === email) {
            setAuthState({ user, loading: false, error: null });
            return;
          }
        }
        
        // If not found, create new local mock user
        const mockUser: User = {
          id: 'local-user-' + Date.now(),
          email,
          username: email.split('@')[0],
          elo_rating: 1200,
          games_played: 0,
          wins: 0,
          losses: 0,
          draws: 0,
        };
        setAuthState({ user: mockUser, loading: false, error: null });
        localStorage.setItem('localUser', JSON.stringify(mockUser));
        return;
      }

      // Real Supabase Sign In
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
    } catch (error: any) {
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to sign in',
      }));
      throw error;
    }
  };

  const signOut = async () => {
    setAuthState(prev => ({ ...prev, loading: true }));
    try {
      if (!configured) {
        localStorage.removeItem('localUser');
        setAuthState({ user: null, loading: false, error: null });
        return;
      }
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error: any) {
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to sign out',
      }));
    }
  };

  return {
    ...authState,
    signUp,
    signIn,
    signOut,
  };
};
