-- 0004: human-readable place name for the dashboard header.
-- We already store lat/lon for weather; "40.71, -74.01" is useless to read.
alter table profiles
  add column if not exists location_name text;
