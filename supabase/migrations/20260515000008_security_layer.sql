-- ── Audit log for GDPR compliance ────────────────────────────────────────────
create table if not exists public.audit_log (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.users(id) on delete cascade,
  action      text        not null,
  metadata    jsonb       not null default '{}',
  ip_address  text,
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_user_created_idx
  on public.audit_log (user_id, created_at desc);

alter table public.audit_log enable row level security;

create policy "audit_log_select_own"
  on public.audit_log for select
  using (auth.uid() = user_id);

-- ── Belt-and-suspenders: ensure RLS is ON for every user-data table ───────────
alter table public.users             enable row level security;
alter table public.people            enable row level security;
alter table public.relationships     enable row level security;
alter table public.memories          enable row level security;
alter table public.signals           enable row level security;
alter table public.human_state_logs  enable row level security;
alter table public.briefings         enable row level security;
alter table public.notification_logs enable row level security;
alter table public.analytics_events  enable row level security;
alter table public.ai_usage          enable row level security;
