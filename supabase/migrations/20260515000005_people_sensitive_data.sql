alter table public.people
  add column if not exists cycle_data        jsonb,
  add column if not exists sensitive_context jsonb;
