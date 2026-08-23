-- 0006: the scheduling assistant.
--   * bring-your-own LLM key (Anthropic / OpenAI / none)
--   * an activity catalog with durations
--   * durations on habits, so tracked habits are schedulable too
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- llm_credentials
--
-- One row per user. The key is encrypted with the same AES-256-GCM machinery as
-- Google refresh tokens (lib/crypto.ts) — storing someone else's API key makes
-- us a custodian of their credential and their money, so it never sits in
-- plaintext, never goes back to the browser, and never reaches a log.
--
-- Cost lands on the key's owner, which is what makes this feature free to run
-- at any number of users.
-- ---------------------------------------------------------------------------
create table if not exists llm_credentials (
  user_id      uuid primary key references profiles(id) on delete cascade,
  provider     text not null check (provider in ('anthropic', 'openai')),
  api_key_enc  text not null,
  -- Last 4 characters only, so the UI can show which key is saved without
  -- being able to reveal it.
  key_hint     text not null,
  model        text,
  status       text not null default 'untested',   -- 'untested'|'ok'|'error'
  last_error   text,
  verified_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- activities: the things you might want to fit into a gap.
-- ---------------------------------------------------------------------------
create table if not exists activities (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references profiles(id) on delete cascade,
  name             text not null,
  duration_minutes int not null check (duration_minutes between 5 and 1440),
  -- Optional windowing: gym at 6am is plausible, groceries at 6am is not.
  earliest_hour    int check (earliest_hour between 0 and 23),
  latest_hour      int check (latest_hour between 0 and 24),
  -- 0=Sun … 6=Sat. Empty means any day.
  days_of_week     int[] not null default '{}',
  notes            text,
  archived         boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (user_id, name)
);
create index if not exists activities_user_idx on activities(user_id) where archived = false;

-- Habits become schedulable once they have a duration.
alter table habits
  add column if not exists duration_minutes int check (duration_minutes between 5 and 1440);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table llm_credentials enable row level security;
alter table activities      enable row level security;

drop policy if exists own_rows on llm_credentials;
create policy own_rows on llm_credentials for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists own_rows on activities;
create policy own_rows on activities for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Starter catalog, so the assistant has something to reason about on day one.
-- ---------------------------------------------------------------------------
insert into activities (user_id, name, duration_minutes, earliest_hour, latest_hour)
select p.id, a.name, a.mins, a.lo, a.hi
from profiles p
cross join (values
  ('Gym',                     90,  6, 22),
  ('Groceries in the city',   60,  9, 21),
  ('Board games',            180, 17, 24),
  ('Exploring the city',     240, 10, 22),
  ('Deep work block',        120,  8, 20),
  ('Call home',               30,  8, 23)
) as a(name, mins, lo, hi)
on conflict (user_id, name) do nothing;
