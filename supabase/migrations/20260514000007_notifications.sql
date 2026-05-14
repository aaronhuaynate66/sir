-- Notification types
create type public.notification_type as enum (
  'birthday_reminder',
  'reconnect_suggestion',
  'signal_opportunity',
  'weekly_digest',
  'briefing_ready'
);

create type public.notification_channel as enum ('push', 'email', 'in_app');
create type public.notification_status  as enum ('pending', 'sent', 'failed', 'read');

-- notification_logs table
create table public.notification_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  type          public.notification_type    not null,
  channel       public.notification_channel not null,
  title         text not null,
  body          text not null,
  person_id     uuid references public.people(id)  on delete set null,
  signal_id     uuid references public.signals(id) on delete set null,
  urgency_score numeric(3,2) not null default 0.5
    constraint chk_urgency check (urgency_score between 0 and 1),
  sent_at       timestamptz,
  read_at       timestamptz,
  status        public.notification_status not null default 'pending',
  metadata      jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

create index notification_logs_user_created_idx
  on public.notification_logs(user_id, created_at desc);
create index notification_logs_unread_idx
  on public.notification_logs(user_id, status)
  where status != 'read';
create index notification_logs_type_idx
  on public.notification_logs(user_id, type, created_at desc);

alter table public.notification_logs enable row level security;

create policy "notification_logs_select_own"
  on public.notification_logs for select
  using (auth.uid() = user_id);

create policy "notification_logs_update_own"
  on public.notification_logs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Notification preferences on users
alter table public.users
  add column if not exists push_enabled       boolean     not null default true,
  add column if not exists email_enabled      boolean     not null default true,
  add column if not exists dnd_start_hour     smallint    not null default 22
    constraint chk_dnd_start check (dnd_start_hour between 0 and 23),
  add column if not exists dnd_end_hour       smallint    not null default 8
    constraint chk_dnd_end   check (dnd_end_hour  between 0 and 23),
  add column if not exists max_notifs_per_day smallint    not null default 3,
  add column if not exists expo_push_token    text,
  add column if not exists timezone           text        not null default 'UTC';

-- Birthday field on people (needed for birthday_reminder trigger)
alter table public.people
  add column if not exists birthday date;
