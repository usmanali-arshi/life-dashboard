-- People photos: a selfie per contact, stored in a private Storage bucket.
-- Purely additive. See docs/people-feature.md §8.

alter table people.contacts add column if not exists photo_path text;

-- Private bucket; objects are read only through signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('people-photos', 'people-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Object paths are <user_id>/<contact_id>.jpg. Every operation is limited to the
-- caller's own top-level folder, so one user can never list, read or overwrite another's.
drop policy if exists people_photos_select on storage.objects;
create policy people_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'people-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists people_photos_insert on storage.objects;
create policy people_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'people-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists people_photos_update on storage.objects;
create policy people_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'people-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'people-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists people_photos_delete on storage.objects;
create policy people_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'people-photos' and (storage.foldername(name))[1] = auth.uid()::text);
