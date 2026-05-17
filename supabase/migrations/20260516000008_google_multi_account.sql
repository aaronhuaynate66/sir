-- Allow multiple Google accounts per user
ALTER TABLE public.google_integrations
  DROP CONSTRAINT IF EXISTS google_integrations_user_id_key;

ALTER TABLE public.google_integrations
  ADD COLUMN IF NOT EXISTS account_email text,
  ADD COLUMN IF NOT EXISTS account_name  text,
  ADD COLUMN IF NOT EXISTS is_primary    boolean NOT NULL DEFAULT false;

-- Unique per (user, account) — partial so NULL rows are still allowed during migration
CREATE UNIQUE INDEX IF NOT EXISTS google_integrations_user_account
  ON public.google_integrations (user_id, account_email)
  WHERE account_email IS NOT NULL;
