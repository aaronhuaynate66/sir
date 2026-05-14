create table public.human_state_logs (
  id                 uuid        primary key default uuid_generate_v4(),
  user_id            uuid        not null references public.users(id) on delete cascade,
  mood_score         int         not null check (mood_score >= 1 and mood_score <= 5),
  energy_score       int         not null check (energy_score >= 1 and energy_score <= 10),
  physical_tags      text[]      not null default '{}',
  emotional_tags     text[]      not null default '{}',
  notes              text,
  composite_score    int         not null default 0 check (composite_score >= 0 and composite_score <= 100),
  availability_score int         not null default 0 check (availability_score >= 0 and availability_score <= 100),
  interaction_risk   int         not null default 0 check (interaction_risk >= 0 and interaction_risk <= 100),
  created_at         timestamptz not null default now()
);

create index on public.human_state_logs (user_id, created_at desc);

alter table public.human_state_logs enable row level security;

create policy "Users manage their own state logs"
  on public.human_state_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
