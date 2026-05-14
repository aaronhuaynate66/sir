create table public.briefings (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.users(id)  on delete cascade,
  person_id     uuid not null references public.people(id) on delete cascade,
  content       text not null,
  input_tokens  int  not null default 0,
  output_tokens int  not null default 0,
  cost_usd      numeric(10,6) not null default 0,
  created_at    timestamptz not null default now()
);

create index briefings_person_idx on public.briefings(person_id, created_at desc);
create index briefings_user_idx   on public.briefings(user_id);

alter table public.briefings enable row level security;

create policy "briefings_all_own"
  on public.briefings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
