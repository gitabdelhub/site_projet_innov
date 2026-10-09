-- =========================================================================
-- Chess Hub — migration v4: training progress saved on the account
-- Run once in the Supabase SQL editor, after v3. Safe to run again.
-- It only ADDS a table: nothing existing is changed.
--
-- One row per player holding their training progress (puzzles solved,
-- streaks, lessons, level history...) as JSON. Each player can only read
-- and write their own row.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.learning_progress (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.learning_progress DROP CONSTRAINT IF EXISTS learning_progress_size;
ALTER TABLE public.learning_progress ADD CONSTRAINT learning_progress_size CHECK (pg_column_size(data) < 262144);

ALTER TABLE public.learning_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.learning_progress FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.learning_progress TO authenticated;

DROP POLICY IF EXISTS "Players read their progress" ON public.learning_progress;
DROP POLICY IF EXISTS "Players create their progress" ON public.learning_progress;
DROP POLICY IF EXISTS "Players update their progress" ON public.learning_progress;
CREATE POLICY "Players read their progress" ON public.learning_progress
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Players create their progress" ON public.learning_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Players update their progress" ON public.learning_progress
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
