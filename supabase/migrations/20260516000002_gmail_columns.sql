-- Module 29: Gmail integration columns on google_integrations
ALTER TABLE public.google_integrations
  ADD COLUMN IF NOT EXISTS emails_synced     integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gmail_last_sync_at timestamptz;
