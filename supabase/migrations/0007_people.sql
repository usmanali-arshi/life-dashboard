-- People tab: contacts, places, industries in a dedicated schema.
-- Purely additive — the DB is shared between local dev and production, so this runs
-- against prod the moment it's applied. Do not add anything destructive here.
--
-- Manual step after running this (Usman, in the Supabase dashboard):
--   Project Settings → Data API → Exposed schemas → add `people`.
--   Without it every query fails with a schema error that looks like broken code.

create extension if not exists pg_trgm;
create schema if not exists people;

create table if not exists people.industries (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  name     text not null,
  unique (user_id, name)
);

create table if not exists people.places (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  google_place_id   text,
  name              text not null,
  formatted_address text,
  neighborhood      text,
  lat               double precision,
  lng               double precision,
  created_at        timestamptz not null default now(),
  unique (user_id, google_place_id)
);

create table if not exists people.contacts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null check (length(trim(name)) > 0),
  met_on        date not null,                 -- floating date, see §4 of context doc
  place_id      uuid references people.places(id) on delete set null,
  industry_id   uuid references people.industries(id) on delete set null,
  current_role  text,
  company       text,
  instagram     text,                          -- handle without @, render the URL
  linkedin_url  text,
  phone_e164    text,                          -- normalized with libphonenumber-js
  notes         text,
  search_tsv    tsvector generated always as (
                  to_tsvector('simple',
                    coalesce(name,'') || ' ' || coalesce(company,'') || ' ' ||
                    coalesce(current_role,'') || ' ' || coalesce(notes,''))) stored,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists contacts_user_met_idx on people.contacts (user_id, met_on desc);
create index if not exists contacts_name_trgm_idx on people.contacts using gin (name gin_trgm_ops);
create index if not exists contacts_tsv_idx on people.contacts using gin (search_tsv);
create index if not exists contacts_place_idx on people.contacts (place_id);
create index if not exists contacts_industry_idx on people.contacts (industry_id);

-- RLS on every table
alter table people.industries enable row level security;
alter table people.places     enable row level security;
alter table people.contacts   enable row level security;

drop policy if exists own_rows on people.industries;
create policy own_rows on people.industries for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists own_rows on people.places;
create policy own_rows on people.places for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists own_rows on people.contacts;
create policy own_rows on people.contacts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Non-public schema needs explicit grants
grant usage on schema people to authenticated;
grant select, insert, update, delete on all tables in schema people to authenticated;

-- updated_at trigger
create or replace function people.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists contacts_touch on people.contacts;
create trigger contacts_touch before update on people.contacts
  for each row execute function people.touch_updated_at();

-- ---------------------------------------------------------------------------
-- search_contacts: combines trigram similarity on name with full-text search
-- on search_tsv, filtered in SQL (never client-side) so counts and the visible
-- list can't disagree — same reasoning as the task account filter.
-- ---------------------------------------------------------------------------
create or replace function people.search_contacts(
  q         text,
  place     uuid default null,
  industry  uuid default null,
  met_from  date default null,
  met_to    date default null
) returns setof people.contacts
security invoker
language sql stable as $$
  select c.*
  from people.contacts c
  where c.user_id = auth.uid()
    and (q is null or trim(q) = ''
         or c.name % q
         or c.name ilike '%' || q || '%'
         or c.search_tsv @@ plainto_tsquery('simple', q))
    and (place is null or c.place_id = place)
    and (industry is null or c.industry_id = industry)
    and (met_from is null or c.met_on >= met_from)
    and (met_to is null or c.met_on <= met_to)
  order by c.met_on desc;
$$;

-- ---------------------------------------------------------------------------
-- seed_default_industries: called once per user on first visit to the People
-- tab if they have no industries yet.
-- ---------------------------------------------------------------------------
create or replace function people.seed_default_industries(p_user_id uuid) returns void
security invoker
language plpgsql as $$
begin
  if not exists (select 1 from people.industries where user_id = p_user_id) then
    insert into people.industries (user_id, name)
    values
      (p_user_id, 'Tech'),
      (p_user_id, 'Finance'),
      (p_user_id, 'VC'),
      (p_user_id, 'Media'),
      (p_user_id, 'Fashion'),
      (p_user_id, 'Food & Bev'),
      (p_user_id, 'Academia')
    on conflict (user_id, name) do nothing;
  end if;
end;
$$;
