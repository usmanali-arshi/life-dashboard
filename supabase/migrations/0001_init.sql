-- Life Dashboard — initial schema
-- Run in Supabase SQL Editor. Idempotent enough to re-run during development.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles: one row per app user, mirrors auth.users
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  display_name text,
  timezone    text not null default 'America/New_York',
  -- coarse location for weather; nulls until the user grants/sets it
  lat         double precision,
  lon         double precision,
  created_at  timestamptz not null default now()
);

-- Auto-create a profile whenever a user signs up.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- linked_accounts: N data accounts per app user (Cornell, NYU, personal, work)
-- Deliberately separate from the login identity. See architecture.md section 4.
-- ---------------------------------------------------------------------------
create table if not exists linked_accounts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  provider          text not null default 'google',   -- 'google' | 'todoist' | 'notion' | ...
  provider_user_id  text not null,                    -- Google 'sub' claim
  email             text not null,
  label             text,                             -- 'Cornell', 'Work'
  color             text not null default '#2a78d6',  -- calendar dot color
  refresh_token_enc text not null,                    -- AES-256-GCM, base64(iv|tag|ct)
  scopes            text[] not null default '{}',
  status            text not null default 'active',   -- 'active' | 'reauth_required'
  last_synced_at    timestamptz,
  last_sync_error   text,
  created_at        timestamptz not null default now(),
  unique (user_id, provider, provider_user_id)
);
create index if not exists linked_accounts_user_idx on linked_accounts(user_id);

-- ---------------------------------------------------------------------------
-- sync_state: incremental cursors per (account, resource)
-- Calendar uses syncToken; Gmail uses historyId.
-- ---------------------------------------------------------------------------
create table if not exists sync_state (
  linked_account_id uuid not null references linked_accounts(id) on delete cascade,
  resource          text not null,          -- 'calendar' | 'gmail' | 'tasks'
  cursor            text,
  last_run_at       timestamptz,
  primary key (linked_account_id, resource)
);

-- ---------------------------------------------------------------------------
-- calendar_events
-- ---------------------------------------------------------------------------
create table if not exists calendar_events (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  linked_account_id uuid not null references linked_accounts(id) on delete cascade,
  external_id       text not null,
  calendar_id       text not null,
  title             text,
  description       text,
  location          text,
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  all_day           boolean not null default false,
  status            text,                 -- 'confirmed' | 'tentative' | 'cancelled'
  response_status   text,                 -- your RSVP
  attendee_count    int not null default 0,
  conference_url    text,
  html_link         text,
  deleted           boolean not null default false,
  updated_at        timestamptz not null default now(),
  unique (linked_account_id, external_id)
);
create index if not exists calendar_events_user_time_idx
  on calendar_events(user_id, starts_at) where deleted = false;

-- ---------------------------------------------------------------------------
-- email_threads
-- METADATA AND SNIPPETS ONLY. Never store message bodies or attachments.
-- Purged after 30 days by the retention job.
-- ---------------------------------------------------------------------------
create table if not exists email_threads (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  linked_account_id uuid not null references linked_accounts(id) on delete cascade,
  external_id       text not null,        -- Gmail threadId
  subject           text,
  from_name         text,
  from_email        text,
  snippet           text,                 -- Gmail's own ~200 char preview
  is_unread         boolean not null default false,
  is_important      boolean not null default false,
  is_starred        boolean not null default false,
  needs_reply       boolean not null default false,
  last_message_at   timestamptz not null,
  last_from_me      boolean not null default false,
  message_count     int not null default 1,
  web_url           text,
  deleted           boolean not null default false,
  updated_at        timestamptz not null default now(),
  unique (linked_account_id, external_id)
);
create index if not exists email_threads_user_time_idx
  on email_threads(user_id, last_message_at desc) where deleted = false;
create index if not exists email_threads_triage_idx
  on email_threads(user_id, needs_reply, is_unread) where deleted = false;

-- ---------------------------------------------------------------------------
-- tasks: provider-agnostic shape so Todoist/Notion slot in without migration
-- ---------------------------------------------------------------------------
create table if not exists tasks (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  linked_account_id uuid references linked_accounts(id) on delete cascade,  -- null = native task
  provider          text not null default 'google_tasks',
  external_id       text,
  title             text not null,
  notes             text,
  due               timestamptz,
  due_is_date_only  boolean not null default false,
  completed         boolean not null default false,
  completed_at      timestamptz,
  priority          int check (priority between 1 and 4),
  project_name      text,
  url               text,
  deleted           boolean not null default false,
  updated_at        timestamptz not null default now(),
  unique (linked_account_id, provider, external_id)
);
create index if not exists tasks_user_due_idx
  on tasks(user_id, due) where deleted = false and completed = false;

-- ---------------------------------------------------------------------------
-- habits: fully local, no external provider
-- ---------------------------------------------------------------------------
create table if not exists habits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  name        text not null,
  kind        text not null default 'boolean',  -- 'boolean' | 'count' | 'duration'
  target      numeric,
  unit        text,
  cadence     text not null default 'daily',    -- 'daily' | 'weekly'
  color       text not null default '#1baf7a',
  archived    boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists habit_entries (
  id        uuid primary key default gen_random_uuid(),
  habit_id  uuid not null references habits(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  on_date   date not null,
  value     numeric not null default 1,
  note      text,
  unique (habit_id, on_date)
);
create index if not exists habit_entries_user_date_idx on habit_entries(user_id, on_date desc);

-- ---------------------------------------------------------------------------
-- weather_cache + briefings
-- ---------------------------------------------------------------------------
create table if not exists weather_cache (
  user_id     uuid primary key references profiles(id) on delete cascade,
  payload     jsonb not null,
  fetched_at  timestamptz not null default now()
);

create table if not exists briefings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  on_date     date not null,
  headline    text not null,
  body        text not null,
  generator   text not null default 'template',   -- 'template' | 'claude'
  created_at  timestamptz not null default now(),
  unique (user_id, on_date)
);

-- ---------------------------------------------------------------------------
-- Row Level Security. Multi-user safety enforced by the database, not by
-- remembering to write a WHERE clause. The service_role key bypasses all of
-- this, which is exactly why it is server-only.
-- ---------------------------------------------------------------------------
alter table profiles        enable row level security;
alter table linked_accounts enable row level security;
alter table calendar_events enable row level security;
alter table email_threads   enable row level security;
alter table tasks           enable row level security;
alter table habits          enable row level security;
alter table habit_entries   enable row level security;
alter table weather_cache   enable row level security;
alter table briefings       enable row level security;
alter table sync_state      enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','linked_accounts','calendar_events','email_threads',
    'tasks','habits','habit_entries','weather_cache','briefings'
  ] loop
    execute format('drop policy if exists own_rows on %I', t);
    if t = 'profiles' then
      execute format('create policy own_rows on %I for all using (id = auth.uid()) with check (id = auth.uid())', t);
    else
      execute format('create policy own_rows on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    end if;
  end loop;
end $$;

-- sync_state has no user_id; reach it through its account.
drop policy if exists own_rows on sync_state;
create policy own_rows on sync_state for all
  using (exists (
    select 1 from linked_accounts la
    where la.id = sync_state.linked_account_id and la.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- Retention: drop email metadata older than 30 days. Called by the nightly job.
-- ---------------------------------------------------------------------------
create or replace function purge_old_email() returns void
language sql security definer set search_path = public as $$
  delete from email_threads where last_message_at < now() - interval '30 days';
$$;
