create table public.people (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.users(id) on delete cascade,
  name          text not null,
  email         text,
  phone         text,
  organization  text,
  role          text,
  linkedin_url  text,
  avatar_url    text,
  notes         text,
  tags          text[] not null default '{}',
  language      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger people_updated_at
  before update on public.people
  for each row execute function public.set_updated_at();

create index people_user_id_idx  on public.people(user_id);
create index people_name_idx     on public.people using gin (to_tsvector('simple', name));
create index people_org_idx      on public.people(organization) where organization is not null;

alter table public.people enable row level security;

create policy "people_all_own"
  on public.people for all
  using (auth.uid() = user_id);
