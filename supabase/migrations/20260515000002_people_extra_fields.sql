alter table public.people
  add column if not exists birthday    date,
  add column if not exists instagram_url text,
  add column if not exists anniversary date;

create index if not exists people_birthday
  on public.people (user_id, birthday)
  where birthday is not null;

create index if not exists people_anniversary
  on public.people (user_id, anniversary)
  where anniversary is not null;
