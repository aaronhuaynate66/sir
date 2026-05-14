create type public.relationship_type as enum ('personal', 'professional', 'family');
create type public.relationship_stage as enum ('prospect', 'active', 'strategic', 'dormant');

create table public.relationships (
  id                     uuid primary key default uuid_generate_v4(),
  user_id                uuid not null references public.users(id) on delete cascade,
  person_id              uuid not null references public.people(id) on delete cascade,
  strength               int  not null default 50
                         check (strength >= 0 and strength <= 100),
  reciprocity            int  not null default 50
                         check (reciprocity >= 0 and reciprocity <= 100),
  trust_score            real not null default 0.5
                         check (trust_score >= 0 and trust_score <= 1),
  relationship_type      public.relationship_type not null default 'personal',
  last_contact_at        timestamptz,
  contact_frequency_days int  check (contact_frequency_days > 0),
  stage                  public.relationship_stage not null default 'active',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (user_id, person_id)
);

create trigger relationships_updated_at
  before update on public.relationships
  for each row execute function public.set_updated_at();

create index rel_user_id_idx   on public.relationships(user_id);
create index rel_person_id_idx on public.relationships(person_id);
create index rel_stage_idx     on public.relationships(stage);

alter table public.relationships enable row level security;

create policy "relationships_all_own"
  on public.relationships for all
  using (auth.uid() = user_id);
