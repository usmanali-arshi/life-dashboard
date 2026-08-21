-- 0003: per-account visibility filter + the list id needed to write tasks back.
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Account visibility.
--
-- Stored on the row rather than in localStorage so the filter is identical on
-- every tab, survives a reload, follows you to your phone, and — importantly —
-- can be applied in the SQL that Server Components run, instead of fetching
-- everything and hiding it client-side.
-- ---------------------------------------------------------------------------
alter table linked_accounts
  add column if not exists visible boolean not null default true;

-- ---------------------------------------------------------------------------
-- Google Tasks writes need the owning list id.
--
-- Without it, completing a task meant probing every list until one didn't 404 —
-- fine for a demo, wrong as a write path.
-- ---------------------------------------------------------------------------
alter table tasks
  add column if not exists external_list_id text;

-- Locally-created tasks that haven't been pushed to a provider yet.
alter table tasks
  add column if not exists source text not null default 'provider';

create index if not exists tasks_user_completed_idx
  on tasks(user_id, completed, due) where deleted = false;
