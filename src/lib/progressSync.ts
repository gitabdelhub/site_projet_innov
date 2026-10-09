import { useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import { loadProgress, mergeProgress, saveProgress, PROGRESS_EVENT, EMPTY_PROGRESS, type Progress } from './progress';
import { useAuth } from '../hooks/useAuth';

const UPLOAD_DELAY_MS = 1500;

// Keeps the training progress of this browser and of the account in step.
// Needs supabase-migration-v4.sql; without it, progress simply stays in the browser.
export const useProgressSync = () => {
  const { user } = useAuth();
  const ready = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    ready.current = false;
    if (!user || !isSupabaseConfigured() || user.id.startsWith('local-user')) return;
    let active = true;

    const upload = async () => {
      const data = loadProgress();
      const { error } = await supabase
        .from('learning_progress')
        .upsert({ user_id: user.id, data, updated_at: new Date().toISOString() });
      if (error) console.warn('Progress not saved to the account:', error.message);
    };

    // 1. Merge what the account has with what this browser has
    supabase
      .from('learning_progress')
      .select('data')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.warn('Progress sync unavailable (did you run supabase-migration-v4.sql?)', error.message);
          return;
        }
        const remote: Progress = { ...EMPTY_PROGRESS, ...(data?.data ?? {}) };
        saveProgress(mergeProgress(loadProgress(), remote));
        ready.current = true;
        upload();
      });

    // 2. Then send every change, grouped (a burst of puzzles makes one request)
    const onChange = () => {
      if (!ready.current) return;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(upload, UPLOAD_DELAY_MS);
    };
    window.addEventListener(PROGRESS_EVENT, onChange);
    return () => {
      active = false;
      window.removeEventListener(PROGRESS_EVENT, onChange);
      window.clearTimeout(timer.current);
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
};

// Mount once inside <AuthProvider>
export const ProgressSync = () => {
  useProgressSync();
  return null;
};
