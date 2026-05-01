-- Central preferences (per-user, per-account module visibility)
CREATE TABLE IF NOT EXISTS public.central_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_central_preferences_profile_account
  ON public.central_preferences (profile_id, account_id);

ALTER TABLE public.central_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "central_preferences_select_own" ON public.central_preferences;
CREATE POLICY "central_preferences_select_own"
  ON public.central_preferences FOR SELECT
  USING (profile_id = (select auth.uid()));

DROP POLICY IF EXISTS "central_preferences_insert_own" ON public.central_preferences;
CREATE POLICY "central_preferences_insert_own"
  ON public.central_preferences FOR INSERT
  WITH CHECK (profile_id = (select auth.uid()));

DROP POLICY IF EXISTS "central_preferences_update_own" ON public.central_preferences;
CREATE POLICY "central_preferences_update_own"
  ON public.central_preferences FOR UPDATE
  USING (profile_id = (select auth.uid()))
  WITH CHECK (profile_id = (select auth.uid()));
