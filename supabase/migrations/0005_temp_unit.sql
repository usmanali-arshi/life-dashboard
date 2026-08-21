-- 0005: preferred temperature unit for the weather panel and the briefing.
alter table profiles
  add column if not exists temp_unit text not null default 'F';

do $$
begin
  alter table profiles add constraint profiles_temp_unit_chk check (temp_unit in ('C', 'F'));
exception when duplicate_object then null;
end $$;
