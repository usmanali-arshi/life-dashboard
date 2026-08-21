-- Carry the signup name through to profiles, and backfill anyone who signed up
-- before this existed. Safe to re-run.

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    -- signUp({ options: { data: { display_name } } }) lands in raw_user_meta_data.
    -- full_name / name are what Google's OAuth provider uses, so accept those too.
    nullif(trim(coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      ''
    )), '')
  )
  on conflict (id) do update
    set display_name = coalesce(public.profiles.display_name, excluded.display_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Backfill: create missing profile rows, and fill in names we already have.
insert into public.profiles (id, email, display_name)
select
  u.id, u.email,
  nullif(trim(coalesce(
    u.raw_user_meta_data->>'display_name',
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    ''
  )), '')
from auth.users u
on conflict (id) do update
  set display_name = coalesce(public.profiles.display_name, excluded.display_name);
