alter table public.people
  add column if not exists relationship_type text not null default 'networking';

create index if not exists people_relationship_type
  on public.people (user_id, relationship_type);
