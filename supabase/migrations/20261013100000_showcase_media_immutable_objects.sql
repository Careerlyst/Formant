-- Keep approved Showcase bytes immutable at their Storage path.
-- New media must use a new UUID path and a new database row so the existing
-- publication-review invalidation triggers can clear approval.

begin;

-- Remove the permissive editor UPDATE policy created by the initial Showcase
-- migration. The restrictive policy also protects this bucket if another
-- permissive UPDATE policy is added later.
drop policy if exists showcase_media_staff_update_v1 on storage.objects;

drop policy if exists showcase_media_no_update_v1 on storage.objects;
create policy showcase_media_no_update_v1
  on storage.objects as restrictive for update to public
  using (bucket_id <> 'showcase-media')
  with check (bucket_id <> 'showcase-media');

-- A deleted object path can be reused only after all Showcase metadata rows
-- referencing it have been removed. This prevents delete-and-reinsert from
-- silently replacing bytes while the existing approval row remains intact.
drop policy if exists showcase_media_no_referenced_path_insert_v1 on storage.objects;
create policy showcase_media_no_referenced_path_insert_v1
  on storage.objects as restrictive for insert to authenticated
  with check (
    bucket_id <> 'showcase-media'
    or not exists (
      select 1
      from public.showcase_project_images as image_row
      where image_row.storage_path = name
    )
  );

commit;
